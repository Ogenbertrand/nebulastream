use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentInfo {
    pub id: String,
    pub name: String,
    pub magnet_link: Option<String>,
    pub torrent_url: Option<String>,
    pub status: TorrentStatus,
    pub progress: f32,       // 0.0 to 100.0
    pub download_speed: u64, // bytes per second
    pub upload_speed: u64,   // bytes per second
    pub peers: u32,
    pub seeds: u32,
    pub total_size: Option<u64>, // bytes
    pub downloaded_bytes: u64,
    pub stream_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TorrentStatus {
    Pending,
    MetadataDownloading,
    Downloading,
    Buffering,
    Streaming,
    Paused,
    Completed,
    Error,
    Stopped,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamRequest {
    pub magnet_link: Option<String>,
    pub torrent_url: Option<String>,
    pub name: Option<String>,
    pub quality: Option<String>,   // 480p, 720p, 1080p, etc.
    pub file_index: Option<usize>, // Which file to stream (for multi-file torrents)
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamResponse {
    pub stream_id: String,
    pub stream_url: String,
    pub status_url: String,
    pub ready: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamStatus {
    pub stream_id: String,
    pub ready: bool,
    pub buffer_progress: f32,
    pub download_speed: u64,
    pub peers: u32,
    pub eta_seconds: Option<u64>,
}
