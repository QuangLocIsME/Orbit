# ============================================================
# Dockerfile — Orbit Frontend (Astro SSR with Node adapter)
# ============================================================
FROM node:22-alpine

LABEL maintainer="orbit-team"
LABEL service="orbit-frontend"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4321
ARG BACKEND_URL=http://backend:3000
ARG PUBLIC_API_URL=/api
ARG PUBLIC_BACKEND_WS_URL=https://quangloc.online
ENV BACKEND_URL=$BACKEND_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_BACKEND_WS_URL=$PUBLIC_BACKEND_WS_URL

RUN npm run build

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
