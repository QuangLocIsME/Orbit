# ============================================================
# Dockerfile — Cloudflare Tunnel (cloudflared)
# ============================================================
# Uses official cloudflared image — no credentials baked in.
# Credentials are injected at runtime via docker-compose secrets
# or mounted from host ~/.cloudflared/.
FROM cloudflare/cloudflared:2026.3.0

ENTRYPOINT []
CMD ["cloudflared", "tunnel", "--config", "/etc/cloudflared/config.yml", "run"]
