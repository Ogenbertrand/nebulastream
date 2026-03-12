use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub max_stream_size: usize,
    pub timeout_seconds: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("STREAM_PROXY_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("STREAM_PROXY_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            workers: env::var("STREAM_PROXY_WORKERS")
                .ok()
                .and_then(|w| w.parse().ok())
                .unwrap_or(4),
            max_stream_size: env::var("STREAM_PROXY_MAX_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10 * 1024 * 1024 * 1024), // 10GB default
            timeout_seconds: env::var("STREAM_PROXY_TIMEOUT")
                .ok()
                .and_then(|t| t.parse().ok())
                .unwrap_or(30),
        }
    }
}
