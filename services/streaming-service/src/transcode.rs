use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;

use tokio::fs;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration, Instant};
use tracing::{info, warn};

use crate::config::Config;
use crate::error::AppError;
use crate::models::{Session, SessionStatus};
use crate::storage::ObjectStorage;

#[derive(Clone)]
struct TranscodeProfile {
    name: &'static str,
    width: u32,
    height: u32,
    video_bitrate: u32,
    maxrate: u32,
    bufsize: u32,
    audio_bitrate: u32,
}

pub struct TranscodeJob {
    pub output_dir: PathBuf,
    pub master_path: PathBuf,
}

fn default_profiles() -> Vec<TranscodeProfile> {
    vec![
        TranscodeProfile {
            name: "480p",
            width: 854,
            height: 480,
            video_bitrate: 900,
            maxrate: 1200,
            bufsize: 1800,
            audio_bitrate: 96,
        },
        TranscodeProfile {
            name: "720p",
            width: 1280,
            height: 720,
            video_bitrate: 2400,
            maxrate: 3000,
            bufsize: 4200,
            audio_bitrate: 128,
        },
        TranscodeProfile {
            name: "1080p",
            width: 1920,
            height: 1080,
            video_bitrate: 4200,
            maxrate: 5200,
            bufsize: 8400,
            audio_bitrate: 160,
        },
    ]
}

pub async fn start_transcode_job(
    session_id: String,
    source_url: String,
    config: Config,
    storage: ObjectStorage,
    sessions: Arc<RwLock<std::collections::HashMap<String, Session>>>,
    headers: Option<std::collections::HashMap<String, String>>,
) -> Result<TranscodeJob, AppError> {
    let output_dir = PathBuf::from(&config.transcode_output_dir).join(&session_id);
    fs::create_dir_all(&output_dir)
        .await
        .map_err(|e| AppError::InternalError(format!("transcode output dir error: {}", e)))?;
    let master_path = output_dir.join("master.m3u8");

    let job = TranscodeJob {
        output_dir: output_dir.clone(),
        master_path: master_path.clone(),
    };

    tokio::spawn(async move {
        if let Err(err) = run_transcode(
            session_id,
            source_url,
            output_dir,
            master_path,
            config,
            storage,
            sessions,
            headers,
        )
        .await
        {
            warn!(error = %err, "Transcode job failed");
        }
    });

    Ok(job)
}

async fn run_transcode(
    session_id: String,
    source_url: String,
    output_dir: PathBuf,
    master_path: PathBuf,
    config: Config,
    storage: ObjectStorage,
    sessions: Arc<RwLock<std::collections::HashMap<String, Session>>>,
    headers: Option<std::collections::HashMap<String, String>>,
) -> Result<(), AppError> {
    let profiles = default_profiles();
    let args = build_ffmpeg_args(
        &source_url,
        &output_dir,
        config.transcode_segment_seconds,
        &config.transcode_preset,
        &profiles,
        headers.as_ref(),
    );

    info!(session_id = %session_id, "Starting FFmpeg transcode");

    let mut cmd = Command::new("ffmpeg");
    cmd.args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::InternalError(format!("ffmpeg spawn error: {}", e)))?;

    if let Some(mut stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::AsyncReadExt;
            let mut buf = Vec::new();
            if stderr.read_to_end(&mut buf).await.is_ok() {
                if let Ok(log) = String::from_utf8(buf) {
                    if !log.trim().is_empty() {
                        warn!(message = %log, "FFmpeg output");
                    }
                }
            }
        });
    }

    let ready_deadline = Instant::now() + Duration::from_secs(config.transcode_ready_timeout_seconds);
    let mut marked_ready = false;
    loop {
        if Instant::now() >= ready_deadline {
            break;
        }

        if fs::try_exists(&master_path).await.unwrap_or(false) {
            if fs::try_exists(output_dir.join("v0/playlist.m3u8")).await.unwrap_or(false) {
                mark_session_ready(&sessions, &session_id).await;
                marked_ready = true;
                break;
            }
        }

        if let Ok(Some(status)) = child.try_wait() {
            if !status.success() {
                mark_session_error(&sessions, &session_id).await;
                return Err(AppError::InternalError("ffmpeg exited early".to_string()));
            }
        }

        sleep(Duration::from_millis(350)).await;
    }

    let status = child
        .wait()
        .await
        .map_err(|e| AppError::InternalError(format!("ffmpeg wait error: {}", e)))?;

    if !status.success() {
        mark_session_error(&sessions, &session_id).await;
        return Err(AppError::InternalError(format!(
            "ffmpeg exited with status {}",
            status
        )));
    }

    if !marked_ready {
        mark_session_ready(&sessions, &session_id).await;
    }

    if config.transcode_upload {
        if let Err(err) = upload_directory(&storage, &output_dir, &session_id).await {
            warn!(error = %err, "Failed to upload transcode output");
        }
    }

    Ok(())
}

async fn mark_session_ready(
    sessions: &Arc<RwLock<std::collections::HashMap<String, Session>>>,
    session_id: &str,
) {
    let mut guard = sessions.write().await;
    if let Some(session) = guard.get_mut(session_id) {
        if session.status != SessionStatus::Ready {
            session.status = SessionStatus::Ready;
        }
    }
}

async fn mark_session_error(
    sessions: &Arc<RwLock<std::collections::HashMap<String, Session>>>,
    session_id: &str,
) {
    let mut guard = sessions.write().await;
    if let Some(session) = guard.get_mut(session_id) {
        session.status = SessionStatus::Error;
    }
}

fn build_ffmpeg_args(
    source_url: &str,
    output_dir: &Path,
    segment_seconds: u64,
    preset: &str,
    profiles: &[TranscodeProfile],
    headers: Option<&std::collections::HashMap<String, String>>,
) -> Vec<String> {
    let mut args = Vec::new();
    args.push("-hide_banner".to_string());
    args.push("-loglevel".to_string());
    args.push("warning".to_string());
    args.push("-y".to_string());
    if let Some(headers) = headers {
        let mut header_blob = String::new();
        for (key, value) in headers {
            header_blob.push_str(key);
            header_blob.push_str(": ");
            header_blob.push_str(value);
            header_blob.push_str("\r\n");
        }
        if !header_blob.is_empty() {
            args.push("-headers".to_string());
            args.push(header_blob);
        }
    }
    args.push("-i".to_string());
    args.push(source_url.to_string());

    let mut filter = String::from("[0:v]split=");
    filter.push_str(&profiles.len().to_string());
    for (idx, _) in profiles.iter().enumerate() {
        filter.push_str(&format!("[v{}]", idx));
    }
    filter.push(';');

    for (idx, profile) in profiles.iter().enumerate() {
        filter.push_str(&format!(
            "[v{}]scale=w='min(iw,{})':h='min(ih,{})':force_original_aspect_ratio=decrease[v{}out];",
            idx, profile.width, profile.height, idx
        ));
    }

    args.push("-filter_complex".to_string());
    args.push(filter);

    for (idx, profile) in profiles.iter().enumerate() {
        args.push("-map".to_string());
        args.push(format!("[v{}out]", idx));
        args.push("-map".to_string());
        args.push("0:a?".to_string());

        args.push(format!("-c:v:{}", idx));
        args.push("libx264".to_string());
        args.push(format!("-preset:v:{}", idx));
        args.push(preset.to_string());
        args.push(format!("-b:v:{}", idx));
        args.push(format!("{}k", profile.video_bitrate));
        args.push(format!("-maxrate:v:{}", idx));
        args.push(format!("{}k", profile.maxrate));
        args.push(format!("-bufsize:v:{}", idx));
        args.push(format!("{}k", profile.bufsize));
        args.push(format!("-profile:v:{}", idx));
        args.push("main".to_string());

        args.push(format!("-c:a:{}", idx));
        args.push("aac".to_string());
        args.push(format!("-b:a:{}", idx));
        args.push(format!("{}k", profile.audio_bitrate));
        args.push(format!("-ac:a:{}", idx));
        args.push("2".to_string());
    }

    args.push("-f".to_string());
    args.push("hls".to_string());
    args.push("-hls_time".to_string());
    args.push(segment_seconds.to_string());
    args.push("-hls_flags".to_string());
    args.push("independent_segments".to_string());
    args.push("-hls_segment_filename".to_string());
    args.push(format!(
        "{}/v%v/seg_%03d.ts",
        output_dir.display()
    ));
    args.push("-master_pl_name".to_string());
    args.push("master.m3u8".to_string());

    let var_map = profiles
        .iter()
        .enumerate()
        .map(|(idx, _)| format!("v:{},a:{}?", idx, idx))
        .collect::<Vec<_>>()
        .join(" ");
    args.push("-var_stream_map".to_string());
    args.push(var_map);
    args.push(format!("{}/v%v/playlist.m3u8", output_dir.display()));

    args
}

async fn upload_directory(
    storage: &ObjectStorage,
    output_dir: &Path,
    session_id: &str,
) -> Result<(), AppError> {
    let mut stack = vec![output_dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let mut entries = fs::read_dir(&dir)
            .await
            .map_err(|e| AppError::InternalError(format!("read_dir error: {}", e)))?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::InternalError(format!("dir entry error: {}", e)))?
        {
            let path = entry.path();
            let metadata = entry
                .metadata()
                .await
                .map_err(|e| AppError::InternalError(format!("metadata error: {}", e)))?;
            if metadata.is_dir() {
                stack.push(path);
                continue;
            }

            let rel = path
                .strip_prefix(output_dir)
                .unwrap_or(&path)
                .to_string_lossy()
                .trim_start_matches('/')
                .to_string();
            let key = format!("sessions/{}/hls/{}", session_id, rel);

            let bytes = fs::read(&path)
                .await
                .map_err(|e| AppError::InternalError(format!("read file error: {}", e)))?;
            let content_type = if rel.ends_with(".m3u8") {
                Some("application/vnd.apple.mpegurl")
            } else if rel.ends_with(".ts") {
                Some("video/mp2t")
            } else {
                None
            };

            storage
                .put_object(&key, bytes.into(), content_type)
                .await?;
        }
    }

    Ok(())
}
