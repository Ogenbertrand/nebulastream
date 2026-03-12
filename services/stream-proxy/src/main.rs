use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use futures::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

mod config;
mod error;
mod proxy;

use config::Config;
use error::AppError;
use proxy::StreamProxy;

#[derive(Deserialize)]
struct ProxyQuery {
    url: String,
}

#[derive(Deserialize)]
struct HealthQuery {
    check_url: Option<String>,
}

#[derive(Clone)]
struct AppState {
    client: Arc<Client>,
    proxy: Arc<StreamProxy>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting NebulaStream Stream Proxy Service");

    // Load configuration
    let config = Config::from_env();
    info!("Configuration loaded: {:?}", config);

    // Create HTTP client
    let client = Arc::new(
        Client::builder()
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to create HTTP client"),
    );

    // Create stream proxy
    let proxy = Arc::new(StreamProxy::new(client.clone()));

    // Create app state
    let state = AppState { client, proxy };

    // Build router
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/proxy", get(proxy_stream))
        .route("/proxy/headers", get(proxy_headers))
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    // Bind address
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("Invalid address");

    info!("Stream Proxy listening on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "service": "NebulaStream Stream Proxy",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Health check",
            "/proxy?url=<url>": "Proxy stream from URL",
            "/proxy/headers?url=<url>": "Get headers from URL"
        }
    }))
}

async fn health_check(
    State(state): State<AppState>,
    Query(query): Query<HealthQuery>,
) -> Result<impl IntoResponse, AppError> {
    let mut response = serde_json::json!({
        "status": "healthy",
        "service": "stream-proxy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    // Optional upstream health check
    if let Some(url) = query.check_url {
        match state.client.head(&url).send().await {
            Ok(res) => {
                response["upstream"] = serde_json::json!({
                    "url": url,
                    "status": res.status().as_u16(),
                    "accessible": res.status().is_success()
                });
            }
            Err(e) => {
                response["upstream"] = serde_json::json!({
                    "url": url,
                    "error": e.to_string(),
                    "accessible": false
                });
            }
        }
    }

    Ok((StatusCode::OK, axum::Json(response)))
}

async fn proxy_stream(
    State(state): State<AppState>,
    Query(query): Query<ProxyQuery>,
) -> Result<Response, AppError> {
    let target_url = &query.url;

    info!("Proxying stream from: {}", target_url);

    // Validate URL
    let parsed_url = url::Url::parse(target_url)
        .map_err(|_| AppError::BadRequest("Invalid URL provided".to_string()))?;

    // Only allow http and https
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(AppError::BadRequest(
            "Only HTTP and HTTPS URLs are allowed".to_string(),
        ));
    }

    // Fetch the stream
    let response = state.client.get(target_url).send().await.map_err(|e| {
        error!("Failed to fetch stream: {}", e);
        AppError::UpstreamError(format!("Failed to fetch stream: {}", e))
    })?;

    let status = response.status();

    if !status.is_success() {
        warn!("Upstream returned error status: {}", status);
        return Err(AppError::UpstreamError(format!(
            "Upstream returned status: {}",
            status
        )));
    }

    // Extract content type
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    // Extract content length if available
    let content_length = response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    // Create streaming body
    let stream = response.bytes_stream().map(|result| {
        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
    });

    let body = Body::from_stream(stream);

    // Build response with appropriate headers
    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type.as_str())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*");

    if let Some(len) = content_length {
        builder = builder.header(header::CONTENT_LENGTH, len);
    }

    // Add cache control for video content
    if content_type.starts_with("video/") || content_type.starts_with("application/x-mpegURL") {
        builder = builder.header(header::CACHE_CONTROL, "public, max-age=3600");
    }

    Ok(builder.body(body).unwrap())
}

async fn proxy_headers(
    State(state): State<AppState>,
    Query(query): Query<ProxyQuery>,
) -> Result<impl IntoResponse, AppError> {
    let target_url = &query.url;

    info!("Fetching headers from: {}", target_url);

    let response = state.client.head(target_url).send().await.map_err(|e| {
        error!("Failed to fetch headers: {}", e);
        AppError::UpstreamError(format!("Failed to fetch headers: {}", e))
    })?;

    let headers: std::collections::HashMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|val| (k.to_string(), val.to_string())))
        .collect();

    Ok((
        StatusCode::OK,
        axum::Json(serde_json::json!({
            "url": target_url,
            "status": response.status().as_u16(),
            "headers": headers
        })),
    ))
}
