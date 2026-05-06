// HTTPS wrapper for Astro SSR frontend
// This script creates an HTTPS server that proxies to the Astro HTTP server

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');

const HTTP_PORT = parseInt(process.env.PORT || '4443') + 1;
const HTTPS_PORT = parseInt(process.env.PORT || '4443');
const HOST = process.env.HOST || '0.0.0.0';

function startServer() {
    if (process.env.SSL_ENABLED !== 'true') {
        console.log('[Frontend] Starting in HTTP mode');
        spawn('node', ['dist/server/entry.mjs'], { stdio: 'inherit', env: process.env });
        return;
    }

    const certPath = process.env.SSL_CERT_PATH || '/etc/ssl/origin-cert.pem';
    const keyPath = process.env.SSL_KEY_PATH || '/etc/ssl/origin-key.pem';

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        console.warn('[Frontend] SSL certs not found, falling back to HTTP');
        spawn('node', ['dist/server/entry.mjs'], { stdio: 'inherit', env: process.env });
        return;
    }

    try {
        const sslOptions = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
        };

        const astro = spawn('node', ['dist/server/entry.mjs'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PORT: String(HTTP_PORT), HOST: '127.0.0.1' }
        });

        astro.stdout.on('data', (d) => process.stdout.write('[Astro] ' + d));
        astro.stderr.on('data', (d) => process.stderr.write('[Astro] ' + d));
        astro.on('error', (e) => console.error('[Astro] Error:', e.message));

        setTimeout(() => {
            const proxy = https.createServer(sslOptions, (req, res) => {
                const options = {
                    hostname: '127.0.0.1',
                    port: HTTP_PORT,
                    path: req.url,
                    method: req.method,
                    headers: { ...req.headers },
                };

                const proxyReq = http.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });

                proxyReq.on('error', (e) => {
                    console.error('[Proxy] Error:', e.message);
                    res.writeHead(502);
                    res.end('Bad Gateway');
                });

                req.pipe(proxyReq);
            });

            proxy.on('error', (e) => console.error('[HTTPS] Error:', e.message));

            proxy.listen(HTTPS_PORT, HOST, () => {
                console.log(`[HTTPS Frontend] Listening on ${HOST}:${HTTPS_PORT} (proxying to 127.0.0.1:${HTTP_PORT})`);
            });
        }, 1500);

    } catch (e) {
        console.error('[Frontend] SSL setup failed:', e.message);
        console.log('[Frontend] Falling back to HTTP mode');
        spawn('node', ['dist/server/entry.mjs'], { stdio: 'inherit', env: process.env });
    }
}

startServer();
