use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionStatus {
    Preparing,
    Ready,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlaylistKind {
    Master,
    Media,
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub movie_id: i64,
    pub tmdb_id: Option<i64>,
    pub title: Option<String>,
    pub year: Option<i32>,
    pub quality: Option<String>,
    pub source_url: Option<String>,
    pub magnet_link: Option<String>,
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub manifest_url: String,
    pub status: SessionStatus,
    pub ready: bool,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SessionStatusResponse {
    pub session_id: String,
    pub status: SessionStatus,
    pub ready: bool,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub movie_id: i64,
    pub tmdb_id: Option<i64>,
    pub title: Option<String>,
    pub year: Option<i32>,
    pub quality: String,
    pub source_url: Option<String>,
    pub source_kind: Option<PlaylistKind>,
    pub upstream_url: Option<String>,
    pub transcoded: bool,
    pub headers: Option<HashMap<String, String>>,
    pub status: SessionStatus,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}
