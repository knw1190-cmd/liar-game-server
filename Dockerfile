# Dockerfile for Liar Game Server
# Multi-stage: builds frontend first, then copies into public/

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY liar-game-frontend/package*.json ./
RUN npm ci
COPY liar-game-frontend/ .
RUN npm run build

# Stage 2: Build server
FROM node:18-alpine
WORKDIR /usr/src/app

COPY liar-game-server/package*.json ./
RUN npm install

COPY liar-game-server/ .

# Copy built frontend into public/ (server serves it via express.static)
COPY --from=frontend-build /app/dist ./public

EXPOSE 3001
CMD ["npm", "start"]