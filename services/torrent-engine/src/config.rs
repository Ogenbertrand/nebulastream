use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub download_path: String,
    pub max_connections: usize,
    pub max_download_speed: Option<u64>, // bytes per second
    pub max_upload_speed: Option<u64>,   // bytes per second
    pub buffer_percent: f32,             // percentage to buffer before streaming
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("TORRENT_ENGINE_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("TORRENT_ENGINE_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8081),
            download_path: env::var("TORRENT_DOWNLOAD_PATH")
                .unwrap_or_else(|_| "/tmp/torrents".to_string()),
            max_connections: env::var("TORRENT_MAX_CONNECTIONS")
                .ok()
                .and_then(|c| c.parse().ok())
                .unwrap_or(100),
            max_download_speed: env::var("TORRENT_MAX_DOWNLOAD_SPEED")
                .ok()
                .and_then(|s| s.parse().ok()),
            max_upload_speed: env::var("TORRENT_MAX_UPLOAD_SPEED")
                .ok()
                .and_then(|s| s.parse().ok()),
            buffer_percent: env::var("TORRENT_BUFFER_PERCENT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(5.0),
        }
    }
}
