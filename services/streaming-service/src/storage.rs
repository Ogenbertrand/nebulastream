use aws_config::meta::region::RegionProviderChain;
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    config::Region,
    error::SdkError,
    operation::get_object::GetObjectError,
    primitives::ByteStream,
    Client,
};
use bytes::Bytes;
use tracing::{info, warn};

use crate::config::Config;
use crate::error::AppError;

#[derive(Clone)]
pub struct ObjectStorage {
    client: Client,
    bucket: String,
}

#[derive(Debug, Clone)]
pub struct StoredObject {
    pub bytes: Bytes,
    pub content_type: Option<String>,
}

impl ObjectStorage {
    pub async fn new(config: &Config) -> Result<Self, AppError> {
        let region_provider = RegionProviderChain::first_try(Region::new(config.s3_region.clone()))
            .or_default_provider()
            .or_else(Region::new("us-east-1"));

        let credentials = Credentials::new(
            config.s3_access_key.clone(),
            config.s3_secret_key.clone(),
            None,
            None,
            "static",
        );

        let shared_config = aws_config::from_env()
            .region(region_provider)
            .credentials_provider(credentials)
            .load()
            .await;

        let mut s3_config_builder = aws_sdk_s3::config::Builder::from(&shared_config);
        if !config.s3_endpoint.is_empty() {
            s3_config_builder = s3_config_builder.endpoint_url(config.s3_endpoint.clone());
        }
        if config.s3_force_path_style {
            s3_config_builder = s3_config_builder.force_path_style(true);
        }

        let client = Client::from_conf(s3_config_builder.build());

        let storage = Self {
            client,
            bucket: config.s3_bucket.clone(),
        };

        storage.ensure_bucket().await?;

        Ok(storage)
    }

    pub async fn ensure_bucket(&self) -> Result<(), AppError> {
        let head = self.client.head_bucket().bucket(&self.bucket).send().await;
        if head.is_ok() {
            return Ok(());
        }

        info!(bucket = %self.bucket, "Creating bucket");
        let create = self
            .client
            .create_bucket()
            .bucket(&self.bucket)
            .send()
            .await;

        if let Err(err) = create {
            let message = err.to_string();
            if message.contains("BucketAlreadyOwnedByYou") || message.contains("BucketAlreadyExists") {
                return Ok(());
            }
            return Err(AppError::StorageError(message));
        }

        Ok(())
    }

    pub async fn get_object(&self, key: &str) -> Result<Option<StoredObject>, AppError> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await;

        match response {
            Ok(output) => {
                let content_type = output.content_type().map(|s| s.to_string());
                let data = output
                    .body
                    .collect()
                    .await
                    .map_err(|e| AppError::StorageError(format!("read object error: {}", e)))?;
                let bytes = Bytes::from(data.into_bytes());
                Ok(Some(StoredObject { bytes, content_type }))
            }
            Err(err) => {
                let message = err.to_string();
                let is_missing = match &err {
                    SdkError::ServiceError(service_err) => {
                        let svc = service_err.err();
                        matches!(svc, GetObjectError::NoSuchKey(_)) || svc.is_no_such_key()
                    }
                    _ => false,
                };
                if is_missing
                    || message.contains("NoSuchKey")
                    || message.contains("NotFound")
                    || message.contains("404")
                {
                    return Ok(None);
                }
                warn!(key = key, error = %message, "Failed to read object");
                Err(AppError::StorageError(message))
            }
        }
    }

    pub async fn put_object(
        &self,
        key: &str,
        bytes: Bytes,
        content_type: Option<&str>,
    ) -> Result<(), AppError> {
        let mut request = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(bytes));

        if let Some(ct) = content_type {
            request = request.content_type(ct.to_string());
        }

        request
            .send()
            .await
            .map_err(|e| AppError::StorageError(format!("write object error: {}", e)))?;

        Ok(())
    }
}
