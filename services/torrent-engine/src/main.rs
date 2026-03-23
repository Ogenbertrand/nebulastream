use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

mod config;
mod engine;
mod models;

use config::Config;
use engine::TorrentEngine;
use models::{StreamRequest, StreamResponse, TorrentInfo, TorrentStatus};

#[derive(Clone)]
struct AppState {
    engine: Arc<TorrentEngine>,
    active_streams: Arc<RwLock<HashMap<String, TorrentInfo>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting NebulaStream Torrent Engine Service");

    // Load configuration
    let config = Config::from_env();
    info!("Configuration loaded: {:?}", config);

    // Create torrent engine
    let engine = Arc::new(TorrentEngine::new(&config).await?);

    // Create app state
    let state = AppState {
        engine,
        active_streams: Arc::new(RwLock::new(HashMap::new())),
    };

    // Build router
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/torrents", post(add_torrent))
        .route("/torrents", get(list_torrents))
        .route("/torrents/{id}", get(get_torrent))
        .route("/torrents/{id}", post(control_torrent))
        .route("/torrents/{id}/delete", post(delete_torrent))
        .route("/stream", post(create_stream))
        .route("/stream/{id}", get(get_stream))
        .route("/stream/{id}/status", get(get_stream_status))
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    // Bind address
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("Invalid address");

    info!("Torrent Engine listening on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "NebulaStream Torrent Engine",
        "version": "1.0.0",
        "features": [
            "magnet-link-parsing",
            "torrent-download",
            "sequential-streaming",
            "stream-management"
        ],
        "endpoints": {
            "/health": "Health check",
            "/torrents": "List/Add torrents",
            "/torrents/{id}": "Get/Control torrent",
            "/stream": "Create stream from torrent",
            "/stream/{id}": "Access stream"
        }
    }))
}

async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let engine_status = state.engine.health_check().await;

    let status = if engine_status { "healthy" } else { "degraded" };

    (
        if engine_status {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(serde_json::json!({
            "status": status,
            "service": "torrent-engine",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "engine_ready": engine_status
        })),
    )
}

async fn add_torrent(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, String>>,
) -> impl IntoResponse {
    let magnet_link = request.get("magnet_link").cloned();
    let torrent_url = request.get("torrent_url").cloned();

    info!(
        "Adding torrent: magnet={:?}, url={:?}",
        magnet_link, torrent_url
    );

    // Validate input
    if magnet_link.is_none() && torrent_url.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Either magnet_link or torrent_url must be provided"
            })),
        );
    }

    // Create torrent info
    let torrent_id = Uuid::new_v4().to_string();
    let info = TorrentInfo {
        id: torrent_id.clone(),
        name: request
            .get("name")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string()),
        magnet_link: magnet_link.clone(),
        torrent_url: torrent_url.clone(),
        status: TorrentStatus::Pending,
        progress: 0.0,
        download_speed: 0,
        upload_speed: 0,
        peers: 0,
        seeds: 0,
        total_size: None,
        downloaded_bytes: 0,
        stream_url: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Store in active streams
    {
        let mut streams = state.active_streams.write().await;
        streams.insert(torrent_id.clone(), info.clone());
    }

    // Start download in background
    let engine = state.engine.clone();
    let streams = state.active_streams.clone();
    let id = torrent_id.clone();

    tokio::spawn(async move {
        if let Err(e) = engine.start_download(&id, magnet_link, torrent_url).await {
            error!("Failed to start download for {}: {}", id, e);

            let mut streams = streams.write().await;
            if let Some(info) = streams.get_mut(&id) {
                info.status = TorrentStatus::Error;
            }
        }
    });

    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "torrent_id": torrent_id,
            "info": info
        })),
    )
}

async fn list_torrents(State(state): State<AppState>) -> impl IntoResponse {
    let streams = state.active_streams.read().await;
    let torrents: Vec<&TorrentInfo> = streams.values().collect();

    Json(serde_json::json!({
        "torrents": torrents,
        "count": torrents.len()
    }))
}

async fn get_torrent(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    let streams = state.active_streams.read().await;

    match streams.get(&id) {
        Some(info) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "torrent": info
            })),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Torrent not found"
            })),
        ),
    }
}

#[derive(Deserialize)]
struct ControlRequest {
    action: String, // pause, resume, stop
}

async fn control_torrent(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(request): Json<ControlRequest>,
) -> impl IntoResponse {
    info!("Controlling torrent {}: action={}", id, request.action);

    let result = match request.action.as_str() {
        "pause" => state.engine.pause_download(&id).await,
        "resume" => state.engine.resume_download(&id).await,
        "stop" => state.engine.stop_download(&id).await,
        _ => Err(anyhow::anyhow!("Invalid action")),
    };

    match result {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "action": request.action,
                "torrent_id": id
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": e.to_string()
            })),
        ),
    }
}

async fn delete_torrent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    info!("Deleting torrent {}", id);

    // Stop download
    let _ = state.engine.stop_download(&id).await;

    // Remove from active streams
    {
        let mut streams = state.active_streams.write().await;
        streams.remove(&id);
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "message": "Torrent deleted"
        })),
    )
}

async fn create_stream(
    State(state): State<AppState>,
    Json(request): Json<StreamRequest>,
) -> impl IntoResponse {
    info!(
        "Creating stream for torrent/magnet: {:?}",
        request.magnet_link
    );

    let stream_id = Uuid::new_v4().to_string();

    // Create stream response
    let response = StreamResponse {
        stream_id: stream_id.clone(),
        stream_url: format!("/stream/{}", stream_id),
        status_url: format!("/stream/{}/status", stream_id),
        ready: false,
        message: "Stream is being prepared".to_string(),
    };

    // Store stream info
    let info = TorrentInfo {
        id: stream_id.clone(),
        name: request.name.unwrap_or_else(|| "Stream".to_string()),
        magnet_link: request.magnet_link.clone(),
        torrent_url: None,
        status: TorrentStatus::Buffering,
        progress: 0.0,
        download_speed: 0,
        upload_speed: 0,
        peers: 0,
        seeds: 0,
        total_size: None,
        downloaded_bytes: 0,
        stream_url: Some(response.stream_url.clone()),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    {
        let mut streams = state.active_streams.write().await;
        streams.insert(stream_id.clone(), info);
    }

    // Start streaming preparation
    let engine = state.engine.clone();
    let streams = state.active_streams.clone();
    let id = stream_id.clone();
    let quality = request.quality.clone();

    tokio::spawn(async move {
        match engine
            .prepare_stream(&id, request.magnet_link, quality)
            .await
        {
            Ok(stream_url) => {
                let mut streams = streams.write().await;
                if let Some(info) = streams.get_mut(&id) {
                    info.stream_url = Some(stream_url);
                    info.status = TorrentStatus::Streaming;
                }
            }
            Err(e) => {
                error!("Failed to prepare stream {}: {}", id, e);
                let mut streams = streams.write().await;
                if let Some(info) = streams.get_mut(&id) {
                    info.status = TorrentStatus::Error;
                }
            }
        }
    });

    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "success": true,
            "stream": response
        })),
    )
}

async fn get_stream(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    let streams = state.active_streams.read().await;

    match streams.get(&id) {
        Some(info) => {
            if let Some(stream_url) = &info.stream_url {
                // Redirect to actual stream
                (
                    StatusCode::TEMPORARY_REDIRECT,
                    [("Location", stream_url.clone())],
                    Json(serde_json::json!({})),
                )
            } else {
                (
                    StatusCode::ACCEPTED,
                    [("Location", String::new())],
                    Json(serde_json::json!({
                        "status": "preparing",
                        "progress": info.progress,
                        "message": "Stream is being prepared, please try again shortly"
                    })),
                )
            }
        }
        None => (
            StatusCode::NOT_FOUND,
            [("Location", String::new())],
            Json(serde_json::json!({
                "error": "Stream not found"
            })),
        ),
    }
}

async fn get_stream_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let streams = state.active_streams.read().await;

    match streams.get(&id) {
        Some(info) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "stream_id": id,
                "status": info.status,
                "progress": info.progress,
                "download_speed": info.download_speed,
                "peers": info.peers,
                "seeds": info.seeds,
                "ready": info.stream_url.is_some() && info.status == TorrentStatus::Streaming,
                "stream_url": info.stream_url
            })),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Stream not found"
            })),
        ),
    }
}
