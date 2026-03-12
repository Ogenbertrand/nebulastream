# Build stage
FROM rust:1.85-slim as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY services/torrent-engine/Cargo.toml ./

# Create dummy main for caching dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Copy source code
COPY services/torrent-engine/src ./src

# Build release binary
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Create torrent download directory
RUN mkdir -p /tmp/torrents && chmod 777 /tmp/torrents

# Copy binary from builder
COPY --from=builder /app/target/release/torrent-engine ./

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8081

ENV RUST_LOG=info
ENV TORRENT_ENGINE_HOST=0.0.0.0
ENV TORRENT_ENGINE_PORT=8081
ENV TORRENT_DOWNLOAD_PATH=/tmp/torrents

CMD ["./torrent-engine"]
