use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use url::Url;

use crate::config::Config;
use crate::error::AppError;
use crate::models::PlaylistKind;
use crate::signing::sign_token;

pub fn detect_playlist_kind(content: &str) -> PlaylistKind {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#EXT-X-STREAM-INF") || trimmed.starts_with("#EXT-X-I-FRAME-STREAM-INF") {
            return PlaylistKind::Master;
        }
    }
    PlaylistKind::Media
}

fn encode_url(url: &str) -> String {
    URL_SAFE_NO_PAD.encode(url.as_bytes())
}

fn quality_profile(quality: &str) -> (u64, &'static str) {
    match quality {
        "4k" | "2160p" => (12000000, "3840x2160"),
        "1080p" => (5000000, "1920x1080"),
        "720p" => (2500000, "1280x720"),
        "480p" => (1200000, "854x480"),
        _ => (3000000, "1280x720"),
    }
}

fn signed_variant_url(
    config: &Config,
    session_id: &str,
    upstream_url: &str,
) -> Result<String, AppError> {
    let token = sign_token(
        &config.signing_secret,
        session_id,
        "variant",
        upstream_url,
        config.manifest_ttl_seconds,
    )?;
    let encoded = encode_url(upstream_url);
    Ok(format!(
        "{}/v1/sessions/{}/variant.m3u8?u={}&token={}",
        config.public_url, session_id, encoded, token
    ))
}

fn signed_segment_url(
    config: &Config,
    session_id: &str,
    upstream_url: &str,
) -> Result<String, AppError> {
    let token = sign_token(
        &config.signing_secret,
        session_id,
        "segment",
        upstream_url,
        config.segment_ttl_seconds,
    )?;
    let encoded = encode_url(upstream_url);
    Ok(format!(
        "{}/v1/sessions/{}/segment?u={}&token={}",
        config.public_url, session_id, encoded, token
    ))
}

fn rewrite_uri_attribute(
    line: &str,
    base_url: &Url,
    session_id: &str,
    config: &Config,
    signed_builder: fn(&Config, &str, &str) -> Result<String, AppError>,
) -> Result<String, AppError> {
    let marker = "URI=\"";
    let start = match line.find(marker) {
        Some(idx) => idx + marker.len(),
        None => return Ok(line.to_string()),
    };
    let remainder = &line[start..];
    let end_offset = match remainder.find('"') {
        Some(idx) => idx,
        None => return Ok(line.to_string()),
    };

    let uri = &remainder[..end_offset];
    let absolute = base_url
        .join(uri)
        .map_err(|_| AppError::BadRequest("invalid playlist URI".to_string()))?;
    let signed = signed_builder(config, session_id, absolute.as_str())?;

    let mut output = String::with_capacity(line.len() + signed.len());
    output.push_str(&line[..start]);
    output.push_str(&signed);
    output.push_str(&line[start + end_offset..]);

    Ok(output)
}

pub fn rewrite_master_playlist(
    content: &str,
    playlist_url: &Url,
    session_id: &str,
    config: &Config,
) -> Result<String, AppError> {
    let mut output = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#EXT-X-MEDIA") || trimmed.starts_with("#EXT-X-I-FRAME-STREAM-INF") {
            let rewritten = rewrite_uri_attribute(
                line,
                playlist_url,
                session_id,
                config,
                signed_variant_url,
            )?;
            output.push_str(&rewritten);
            output.push('\n');
            continue;
        }

        if trimmed.starts_with('#') || trimmed.is_empty() {
            output.push_str(line);
            output.push('\n');
            continue;
        }

        let absolute = playlist_url
            .join(trimmed)
            .map_err(|_| AppError::BadRequest("invalid variant URI".to_string()))?;
        let signed = signed_variant_url(config, session_id, absolute.as_str())?;
        output.push_str(&signed);
        output.push('\n');
    }

    Ok(output)
}

pub fn rewrite_media_playlist(
    content: &str,
    playlist_url: &Url,
    session_id: &str,
    config: &Config,
) -> Result<String, AppError> {
    let mut output = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#EXT-X-KEY") || trimmed.starts_with("#EXT-X-MAP") {
            let rewritten = rewrite_uri_attribute(
                line,
                playlist_url,
                session_id,
                config,
                signed_segment_url,
            )?;
            output.push_str(&rewritten);
            output.push('\n');
            continue;
        }

        if trimmed.starts_with('#') || trimmed.is_empty() {
            output.push_str(line);
            output.push('\n');
            continue;
        }

        let absolute = playlist_url
            .join(trimmed)
            .map_err(|_| AppError::BadRequest("invalid segment URI".to_string()))?;
        let signed = signed_segment_url(config, session_id, absolute.as_str())?;
        output.push_str(&signed);
        output.push('\n');
    }

    Ok(output)
}

pub fn build_single_variant_master(variant_url: &str, quality: &str) -> String {
    let (bandwidth, resolution) = quality_profile(quality);
    format!(
        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH={},RESOLUTION={}\n{}\n",
        bandwidth, resolution, variant_url
    )
}
