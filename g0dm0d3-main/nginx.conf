# G0DM0D3 Frontend — nginx config
#
# Serves the static Next.js export and proxies /v1/ API requests
# to the backend API server (the "api" Docker service).

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # ── Security headers ──────────────────────────────────
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://openrouter.ai https://*.openrouter.ai https://*.huggingface.co; img-src 'self' data: blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    # ── API proxy: /v1/* → backend API server ─────────────
    location /v1/ {
        proxy_pass http://api:7860/v1/;
        proxy_http_version 1.1;

        # SSE / streaming support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;

        # Pass client info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout for streaming responses (races can take 45s+)
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # ── Static files ──────────────────────────────────────
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # ── Cache static assets ───────────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # ── Gzip ──────────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;
}
