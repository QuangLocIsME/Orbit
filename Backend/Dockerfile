# ============================================================
# Dockerfile — Orbit Backend API
# ============================================================
FROM node:20-alpine

LABEL maintainer="orbit-team"
LABEL service="orbit-backend"

WORKDIR /app

COPY package*.json ./

RUN npm install --production=false

COPY . .

EXPOSE 3000

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "app.js"]
