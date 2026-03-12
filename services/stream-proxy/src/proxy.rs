use bytes::Bytes;
use futures::stream::Stream;
use futures::StreamExt;
use reqwest::Client;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use tracing::{debug, info, warn};

pub struct StreamProxy {
    client: Arc<Client>,
}

impl StreamProxy {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }

    pub async fn fetch_stream(
        &self,
        url: &str,
    ) -> Result<(reqwest::Response, Option<u64>), Box<dyn std::error::Error + Send + Sync>> {
        info!("Fetching stream from: {}", url);

        let response = self.client.get(url).send().await?;

        let content_length = response
            .headers()
            .get(reqwest::header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());

        let status = response.status();
        debug!(
            "Response status: {}, content_length: {:?}",
            status, content_length
        );

        if !status.is_success() {
            return Err(format!("Upstream returned error status: {}", status).into());
        }

        Ok((response, content_length))
    }

    pub async fn check_health(&self, url: &str) -> bool {
        match self.client.head(url).send().await {
            Ok(res) => {
                let healthy = res.status().is_success();
                if !healthy {
                    warn!("Health check failed for {}: status {}", url, res.status());
                }
                healthy
            }
            Err(e) => {
                warn!("Health check error for {}: {}", url, e);
                false
            }
        }
    }

    pub fn create_byte_stream(
        &self,
        response: reqwest::Response,
    ) -> impl Stream<Item = Result<Bytes, std::io::Error>> + Send + 'static {
        response.bytes_stream().map(|result| {
            result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
        })
    }
}

/// A stream that buffers and forwards content
pub struct ProxyStream {
    inner: Pin<Box<dyn Stream<Item = Result<Bytes, std::io::Error>> + Send>>,
    bytes_forwarded: u64,
}

impl ProxyStream {
    pub fn new<S>(stream: S) -> Self
    where
        S: Stream<Item = Result<Bytes, std::io::Error>> + Send + 'static,
    {
        Self {
            inner: Box::pin(stream),
            bytes_forwarded: 0,
        }
    }

    pub fn bytes_forwarded(&self) -> u64 {
        self.bytes_forwarded
    }
}

impl Stream for ProxyStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        match self.inner.as_mut().poll_next(cx) {
            Poll::Ready(Some(Ok(bytes))) => {
                self.bytes_forwarded += bytes.len() as u64;
                Poll::Ready(Some(Ok(bytes)))
            }
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}
