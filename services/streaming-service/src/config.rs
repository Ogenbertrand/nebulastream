use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub public_url: String,
    pub signing_secret: String,
    pub session_ttl_seconds: u64,
    pub manifest_ttl_seconds: u64,
    pub segment_ttl_seconds: u64,
    pub upstream_timeout_seconds: u64,
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_bucket: String,
    pub s3_access_key: String,
    pub s3_secret_key: String,
    pub s3_force_path_style: bool,
    pub transcode_enabled: bool,
    pub transcode_output_dir: String,
    pub transcode_segment_seconds: u64,
    pub transcode_preset: String,
    pub transcode_ready_timeout_seconds: u64,
    pub transcode_upload: bool,
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .ok()
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(default)
}

impl Config {
    pub fn from_env() -> Self {
        let host = env::var("STREAMING_SERVICE_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("STREAMING_SERVICE_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(8090);
        let public_url = env::var("STREAMING_PUBLIC_URL")
            .unwrap_or_else(|_| format!("http://localhost:{}", port));

        Self {
            host,
            port,
            public_url,
            signing_secret: env::var("STREAMING_SIGNING_SECRET")
                .unwrap_or_else(|_| "dev-streaming-secret-change-me".to_string()),
            session_ttl_seconds: env_u64("STREAMING_SESSION_TTL_SECONDS", 3600),
            manifest_ttl_seconds: env_u64("STREAMING_MANIFEST_TTL_SECONDS", 120),
            segment_ttl_seconds: env_u64("STREAMING_SEGMENT_TTL_SECONDS", 60),
            upstream_timeout_seconds: env_u64("STREAMING_UPSTREAM_TIMEOUT_SECONDS", 15),
            s3_endpoint: env::var("STREAMING_S3_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:9000".to_string()),
            s3_region: env::var("STREAMING_S3_REGION")
                .unwrap_or_else(|_| "us-east-1".to_string()),
            s3_bucket: env::var("STREAMING_S3_BUCKET")
                .unwrap_or_else(|_| "nebula-media".to_string()),
            s3_access_key: env::var("STREAMING_S3_ACCESS_KEY")
                .unwrap_or_else(|_| "nebula".to_string()),
            s3_secret_key: env::var("STREAMING_S3_SECRET_KEY")
                .unwrap_or_else(|_| "nebula123".to_string()),
            s3_force_path_style: env_bool("STREAMING_S3_FORCE_PATH_STYLE", true),
            transcode_enabled: env_bool("STREAMING_TRANSCODE_ENABLED", false),
            transcode_output_dir: env::var("STREAMING_TRANSCODE_OUTPUT_DIR")
                .unwrap_or_else(|_| "/tmp/nebula-transcode".to_string()),
            transcode_segment_seconds: env_u64("STREAMING_TRANSCODE_SEGMENT_SECONDS", 4),
            transcode_preset: env::var("STREAMING_TRANSCODE_PRESET")
                .unwrap_or_else(|_| "veryfast".to_string()),
            transcode_ready_timeout_seconds: env_u64("STREAMING_TRANSCODE_READY_TIMEOUT_SECONDS", 8),
            transcode_upload: env_bool("STREAMING_TRANSCODE_UPLOAD", true),
        }
    }
}
