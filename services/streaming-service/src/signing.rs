use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
struct TokenClaims {
    session_id: String,
    purpose: String,
    resource_hash: String,
    exp: i64,
}

pub fn hash_resource(resource: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(resource.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

pub fn sign_token(
    secret: &str,
    session_id: &str,
    purpose: &str,
    resource: &str,
    ttl_seconds: u64,
) -> Result<String, AppError> {
    let exp = Utc::now() + Duration::seconds(ttl_seconds as i64);
    let claims = TokenClaims {
        session_id: session_id.to_string(),
        purpose: purpose.to_string(),
        resource_hash: hash_resource(resource),
        exp: exp.timestamp(),
    };

    let payload = serde_json::to_vec(&claims)
        .map_err(|e| AppError::InternalError(format!("token serialize error: {}", e)))?;
    let payload_b64 = URL_SAFE_NO_PAD.encode(&payload);

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::InternalError(format!("token sign error: {}", e)))?;
    mac.update(&payload);
    let signature = mac.finalize().into_bytes();
    let signature_b64 = URL_SAFE_NO_PAD.encode(signature);

    Ok(format!("{}.{}", payload_b64, signature_b64))
}

pub fn verify_token(
    secret: &str,
    token: &str,
    session_id: &str,
    purpose: &str,
    resource: &str,
) -> Result<(), AppError> {
    let (payload_b64, signature_b64) = token
        .split_once('.')
        .ok_or_else(|| AppError::Unauthorized("invalid token format".to_string()))?;

    let payload = URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| AppError::Unauthorized("invalid token payload".to_string()))?;
    let signature = URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|_| AppError::Unauthorized("invalid token signature".to_string()))?;

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::InternalError(format!("token verify error: {}", e)))?;
    mac.update(&payload);
    mac.verify_slice(&signature)
        .map_err(|_| AppError::Unauthorized("invalid token".to_string()))?;

    let claims: TokenClaims = serde_json::from_slice(&payload)
        .map_err(|_| AppError::Unauthorized("invalid token claims".to_string()))?;

    if claims.session_id != session_id {
        return Err(AppError::Unauthorized("token session mismatch".to_string()));
    }
    if claims.purpose != purpose {
        return Err(AppError::Unauthorized("token purpose mismatch".to_string()));
    }

    let expected_hash = hash_resource(resource);
    if claims.resource_hash != expected_hash {
        return Err(AppError::Unauthorized("token resource mismatch".to_string()));
    }

    if claims.exp <= Utc::now().timestamp() {
        return Err(AppError::Unauthorized("token expired".to_string()));
    }

    Ok(())
}
