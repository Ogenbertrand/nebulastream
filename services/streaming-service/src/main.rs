use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use bytes::Bytes;
use chrono::{Duration, Utc};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use url::Url;
use uuid::Uuid;

mod config;
mod error;
mod hls;
mod models;
mod signing;
mod storage;
mod transcode;

use config::Config;
use error::AppError;
use hls::{build_single_variant_master, detect_playlist_kind, rewrite_master_playlist, rewrite_media_playlist};
use models::{CreateSessionRequest, CreateSessionResponse, PlaylistKind, Session, SessionStatus, SessionStatusResponse};
use signing::{hash_resource, sign_token, verify_token};
use storage::ObjectStorage;
use transcode::start_transcode_job;

#[derive(Clone)]
struct AppState {
    config: Config,
    http_client: Client,
    storage: ObjectStorage,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

#[derive(Deserialize)]
struct TokenQuery {
    token: String,
}

#[derive(Deserialize)]
struct SignedUrlQuery {
    token: String,
    u: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting NebulaStream Streaming Service");

    let config = Config::from_env();
    info!("Configuration loaded: {:?}", config);

    let http_client = Client::builder()
        .timeout(std::time::Duration::from_secs(config.upstream_timeout_seconds))
        .build()
        .expect("Failed to build HTTP client");

    let storage = ObjectStorage::new(&config).await?;

    let state = AppState {
        config,
        http_client,
        storage,
        sessions: Arc::new(RwLock::new(HashMap::new())),
    };

    let addr: SocketAddr = format!("{}:{}", state.config.host, state.config.port)
        .parse()
        .expect("Invalid address");

    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .route("/v1/sessions", post(create_session))
        .route("/v1/sessions/{id}", get(get_session_status))
        .route("/v1/sessions/{id}/master.m3u8", get(get_master_manifest))
        .route("/v1/sessions/{id}/variant.m3u8", get(get_variant_manifest))
        .route("/v1/sessions/{id}/segment", get(get_segment))
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    info!("Streaming Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "nebula-streaming-service",
        "version": "0.1.0",
        "endpoints": {
            "/health": "Health check",
            "/v1/sessions": "Create playback session",
            "/v1/sessions/{id}": "Session status",
            "/v1/sessions/{id}/master.m3u8": "Signed master manifest"
        }
    }))
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    let storage_ok = state.storage.ensure_bucket().await.is_ok();

    let status = if storage_ok { "healthy" } else { "degraded" };

    (
        if storage_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE },
        Json(serde_json::json!({
            "status": status,
            "service": "streaming-service",
            "timestamp": Utc::now().to_rfc3339(),
            "storage_ready": storage_ok,
        })),
    )
}

async fn create_session(
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<impl IntoResponse, AppError> {
    if request.source_url.is_none() && request.magnet_link.is_none() {
        return Err(AppError::BadRequest(
            "source_url or magnet_link is required".to_string(),
        ));
    }

    let now = Utc::now();
    let expires_at = now + Duration::seconds(state.config.session_ttl_seconds as i64);
    let session_id = Uuid::new_v4().to_string();

    let quality = request.quality.clone().unwrap_or_else(|| "720p".to_string());

    let mut status = SessionStatus::Preparing;
    let mut source_kind = None;
    let mut upstream_url: Option<String> = None;
    let mut transcoded = false;
    let mut final_source_url = request.source_url.clone();
    let headers = request.headers.clone();

    if let Some(source_url) = &request.source_url {
        let parsed = Url::parse(source_url)
            .map_err(|_| AppError::BadRequest("invalid source_url".to_string()))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err(AppError::BadRequest("source_url must be http(s)".to_string()));
        }

        if state.config.transcode_enabled {
            let output_dir = std::path::PathBuf::from(&state.config.transcode_output_dir)
                .join(&session_id);
            let master_path = output_dir.join("master.m3u8");
            let master_url = Url::from_file_path(&master_path)
                .map_err(|_| AppError::InternalError("invalid transcode path".to_string()))?
                .to_string();

            match start_transcode_job(
                session_id.clone(),
                source_url.clone(),
                state.config.clone(),
                state.storage.clone(),
                state.sessions.clone(),
                headers.clone(),
            )
            .await
            {
                Ok(job) => {
                    upstream_url = Some(source_url.clone());
                    final_source_url = Some(master_url);
                    source_kind = Some(PlaylistKind::Master);
                    transcoded = true;

                    let ready_deadline = Utc::now()
                        + Duration::seconds(state.config.transcode_ready_timeout_seconds as i64);
                    while Utc::now() < ready_deadline {
                        if tokio::fs::try_exists(&job.master_path).await.unwrap_or(false)
                            && tokio::fs::try_exists(job.output_dir.join("v0/playlist.m3u8"))
                                .await
                                .unwrap_or(false)
                        {
                            status = SessionStatus::Ready;
                            break;
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                    }
                }
                Err(err) => {
                    warn!(error = %err, "Transcode setup failed, falling back to passthrough");
                }
            }
        }

        if !transcoded {
            let manifest = fetch_text(&state.http_client, source_url, headers.as_ref()).await?;
            source_kind = Some(detect_playlist_kind(&manifest));
            status = SessionStatus::Ready;
        }
    }

    let session = Session {
        id: session_id.clone(),
        movie_id: request.movie_id,
        tmdb_id: request.tmdb_id,
        title: request.title,
        year: request.year,
        quality,
        source_url: final_source_url,
        source_kind,
        upstream_url,
        transcoded,
        headers,
        status,
        created_at: now,
        expires_at,
    };

    {
        let mut sessions = state.sessions.write().await;
        purge_expired_sessions(&mut sessions);
        sessions.insert(session_id.clone(), session.clone());
    }

    let token = sign_token(
        &state.config.signing_secret,
        &session_id,
        "manifest",
        &session_id,
        state.config.manifest_ttl_seconds,
    )?;

    let manifest_url = format!(
        "{}/v1/sessions/{}/master.m3u8?token={}",
        state.config.public_url, session_id, token
    );

    Ok((
        StatusCode::CREATED,
        Json(CreateSessionResponse {
            session_id,
            manifest_url,
            status: session.status,
            ready: session.status == SessionStatus::Ready,
            expires_at: session.expires_at,
        }),
    ))
}

async fn get_session_status(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let session = get_session(&state, &session_id).await?;

    Ok(Json(SessionStatusResponse {
        session_id: session.id,
        status: session.status,
        ready: session.status == SessionStatus::Ready,
        expires_at: session.expires_at,
    }))
}

async fn get_master_manifest(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Query(query): Query<TokenQuery>,
) -> Result<Response, AppError> {
    let session = get_session(&state, &session_id).await?;
    ensure_session_active(&state, &session)?;

    verify_token(
        &state.config.signing_secret,
        &query.token,
        &session_id,
        "manifest",
        &session_id,
    )?;

    let source_url = session
        .source_url
        .clone()
        .ok_or_else(|| AppError::TooEarly("source not ready".to_string()))?;
    let playlist_url = Url::parse(&source_url)
        .map_err(|_| AppError::BadRequest("invalid source_url".to_string()))?;

    let manifest = fetch_text_source(&state, &source_url, session.headers.as_ref()).await?;

    let kind = session.source_kind.unwrap_or_else(|| detect_playlist_kind(&manifest));
    let rewritten = match kind {
        PlaylistKind::Master => rewrite_master_playlist(
            &manifest,
            &playlist_url,
            &session_id,
            &state.config,
        )?,
        PlaylistKind::Media => {
            let raw_master = build_single_variant_master(&source_url, &session.quality);
            rewrite_master_playlist(&raw_master, &playlist_url, &session_id, &state.config)?
        }
    };

    Ok(text_response(
        rewritten,
        "application/vnd.apple.mpegurl",
    ))
}

async fn get_variant_manifest(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Query(query): Query<SignedUrlQuery>,
) -> Result<Response, AppError> {
    let session = get_session(&state, &session_id).await?;
    ensure_session_active(&state, &session)?;

    let upstream_url = decode_signed_url(&query.u)?;

    verify_token(
        &state.config.signing_secret,
        &query.token,
        &session_id,
        "variant",
        &upstream_url,
    )?;

    let playlist_url = Url::parse(&upstream_url)
        .map_err(|_| AppError::BadRequest("invalid variant url".to_string()))?;
    let manifest = fetch_text_source(&state, &upstream_url, session.headers.as_ref()).await?;
    let kind = detect_playlist_kind(&manifest);

    let rewritten = match kind {
        PlaylistKind::Master => rewrite_master_playlist(
            &manifest,
            &playlist_url,
            &session_id,
            &state.config,
        )?,
        PlaylistKind::Media => rewrite_media_playlist(
            &manifest,
            &playlist_url,
            &session_id,
            &state.config,
        )?,
    };

    Ok(text_response(
        rewritten,
        "application/vnd.apple.mpegurl",
    ))
}

async fn get_segment(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Query(query): Query<SignedUrlQuery>,
) -> Result<Response, AppError> {
    let session = get_session(&state, &session_id).await?;
    ensure_session_active(&state, &session)?;

    let upstream_url = decode_signed_url(&query.u)?;

    verify_token(
        &state.config.signing_secret,
        &query.token,
        &session_id,
        "segment",
        &upstream_url,
    )?;

    let object_key = format!("sessions/{}/segments/{}", session_id, hash_resource(&upstream_url));

    if let Some(stored) = state.storage.get_object(&object_key).await? {
        return Ok(binary_response(
            stored.bytes,
            stored.content_type.as_deref().unwrap_or("video/mp2t"),
        ));
    }

    if upstream_url.starts_with("s3://") || upstream_url.starts_with("file://") {
        let (bytes, content_type) =
            fetch_bytes_source(&state, &upstream_url, session.headers.as_ref()).await?;
        return Ok(binary_response(bytes, &content_type));
    }

    let response = fetch_http(&state.http_client, &upstream_url, session.headers.as_ref()).await?;
    if !response.status().is_success() {
        warn!(
            status = %response.status(),
            url = %upstream_url,
            "Upstream segment fetch failed"
        );
        return Err(AppError::UpstreamError(format!(
            "upstream returned {}",
            response.status()
        )));
    }

    let mut content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("video/mp2t")
        .to_string();

    let bytes = response.bytes().await?;

    if (content_type.starts_with("text/") || content_type == "application/octet-stream")
        && bytes.first() == Some(&0x47)
    {
        content_type = "video/mp2t".to_string();
    }

    if let Err(err) = state
        .storage
        .put_object(&object_key, bytes.clone(), Some(&content_type))
        .await
    {
        warn!(key = %object_key, error = %err, "Failed to cache segment");
    }

    Ok(binary_response(bytes, &content_type))
}

fn text_response(body: String, content_type: &str) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).unwrap())
}

fn binary_response(body: Bytes, content_type: &str) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).unwrap())
}

async fn fetch_text(
    client: &Client,
    url: &str,
    headers: Option<&std::collections::HashMap<String, String>>,
) -> Result<String, AppError> {
    let response = fetch_http(client, url, headers).await?;
    if !response.status().is_success() {
        return Err(AppError::UpstreamError(format!(
            "upstream returned {}",
            response.status()
        )));
    }
    Ok(response.text().await?)
}

async fn fetch_text_source(
    state: &AppState,
    url: &str,
    headers: Option<&std::collections::HashMap<String, String>>,
) -> Result<String, AppError> {
    if url.starts_with("s3://") {
        let key = parse_s3_key(url)?;
        let object = state
            .storage
            .get_object(&key)
            .await?
            .ok_or_else(|| AppError::NotFound("object not found".to_string()))?;
        return String::from_utf8(object.bytes.to_vec())
            .map_err(|_| AppError::BadRequest("invalid object encoding".to_string()));
    }

    if url.starts_with("file://") {
        let path = parse_file_path(url)?;
        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| AppError::NotFound(format!("file not found: {}", e)))?;
        return Ok(content);
    }

    fetch_text(&state.http_client, url, headers).await
}

async fn fetch_bytes_source(
    state: &AppState,
    url: &str,
    headers: Option<&std::collections::HashMap<String, String>>,
) -> Result<(Bytes, String), AppError> {
    if url.starts_with("s3://") {
        let key = parse_s3_key(url)?;
        let object = state
            .storage
            .get_object(&key)
            .await?
            .ok_or_else(|| AppError::NotFound("object not found".to_string()))?;
        let content_type = object
            .content_type
            .unwrap_or_else(|| "application/octet-stream".to_string());
        return Ok((object.bytes, content_type));
    }

    if url.starts_with("file://") {
        let path = parse_file_path(url)?;
        let bytes = tokio::fs::read(&path)
            .await
            .map_err(|e| AppError::NotFound(format!("file not found: {}", e)))?;
        let content_type = if path.extension().and_then(|s| s.to_str()) == Some("m3u8") {
            "application/vnd.apple.mpegurl".to_string()
        } else if path.extension().and_then(|s| s.to_str()) == Some("ts") {
            "video/mp2t".to_string()
        } else {
            "application/octet-stream".to_string()
        };
        return Ok((Bytes::from(bytes), content_type));
    }

    let response = fetch_http(&state.http_client, url, headers).await?;
    if !response.status().is_success() {
        return Err(AppError::UpstreamError(format!(
            "upstream returned {}",
            response.status()
        )));
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().await?;
    Ok((bytes, content_type))
}

fn parse_s3_key(url: &str) -> Result<String, AppError> {
    let parsed = Url::parse(url)
        .map_err(|_| AppError::BadRequest("invalid s3 url".to_string()))?;
    let key = parsed.path().trim_start_matches('/');
    if key.is_empty() {
        return Err(AppError::BadRequest("invalid s3 url".to_string()));
    }
    Ok(key.to_string())
}

fn parse_file_path(url: &str) -> Result<PathBuf, AppError> {
    let parsed = Url::parse(url)
        .map_err(|_| AppError::BadRequest("invalid file url".to_string()))?;
    parsed
        .to_file_path()
        .map_err(|_| AppError::BadRequest("invalid file url".to_string()))
}

async fn fetch_http(
    client: &Client,
    url: &str,
    headers: Option<&std::collections::HashMap<String, String>>,
) -> Result<reqwest::Response, AppError> {
    let mut request = client.get(url);
    if let Some(headers) = headers {
        for (key, value) in headers {
            if let (Ok(name), Ok(val)) = (
                reqwest::header::HeaderName::from_bytes(key.as_bytes()),
                reqwest::header::HeaderValue::from_str(value),
            ) {
                request = request.header(name, val);
            }
        }
    }
    let response = request.send().await.map_err(AppError::from)?;

    // Some upstream hosts reject requests with embed referrers. If we get a 401/403
    // and we sent headers, retry once without headers as a fallback.
    if (response.status() == reqwest::StatusCode::FORBIDDEN
        || response.status() == reqwest::StatusCode::UNAUTHORIZED)
        && headers.is_some()
    {
        return client.get(url).send().await.map_err(AppError::from);
    }

    Ok(response)
}

async fn get_session(state: &AppState, session_id: &str) -> Result<Session, AppError> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(session_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound("session not found".to_string()))?;
    Ok(session)
}

fn ensure_session_active(state: &AppState, session: &Session) -> Result<(), AppError> {
    if session.expires_at <= Utc::now() {
        let state = state.clone();
        let session_id = session.id.clone();
        tokio::spawn(async move {
            let mut sessions = state.sessions.write().await;
            sessions.remove(&session_id);
        });
        return Err(AppError::Unauthorized("session expired".to_string()));
    }

    if session.status != SessionStatus::Ready {
        return Err(AppError::TooEarly("session not ready".to_string()));
    }

    Ok(())
}

fn purge_expired_sessions(sessions: &mut HashMap<String, Session>) {
    let now = Utc::now();
    sessions.retain(|_, session| session.expires_at > now);
}

fn decode_signed_url(encoded: &str) -> Result<String, AppError> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| AppError::BadRequest("invalid url encoding".to_string()))?;
    let decoded = String::from_utf8(bytes)
        .map_err(|_| AppError::BadRequest("invalid url encoding".to_string()))?;
    Ok(decoded)
}
