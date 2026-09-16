# JAGGU Backend Server Deployment Guide

This guide provides production-ready deployment instructions for the JAGGU Backend Proxy Server (`packages/jaggu-server`).

---

## 1. Local Deployment with Docker & Docker Compose

### Prerequisites
- Docker Engine 20.10+
- Docker Compose v2+
- Node.js 20+ (if testing locally without containers)

### Quickstart (Docker Compose)
1. Ensure your `.env` file exists at `packages/jaggu-server/.env`:
   ```bash
   cp packages/jaggu-server/.env.example packages/jaggu-server/.env
   # Add your OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.
   ```
2. Build and launch the container in detached mode:
   ```bash
   docker compose up -d --build
   ```
3. Verify container health status:
   ```bash
   docker compose ps
   curl -i http://localhost:3000/health
   ```
4. View real-time streaming logs:
   ```bash
   docker compose logs -f jaggu-server
   ```
5. Stop the container:
   ```bash
   docker compose down
   ```

---

## 2. Deploying to Railway

Railway provides effortless zero-downtime container hosting with automatic HTTPS.

1. Install the Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```
2. Login and link your project:
   ```bash
   railway login
   railway init
   ```
3. Set the Dockerfile path in your project settings:
   - In Railway Dashboard -> **Service Settings** -> **Deploy**:
     - **Dockerfile Path**: `packages/jaggu-server/Dockerfile`
     - **Context Path**: `/` (repository root)
4. Add your secrets in Railway Dashboard -> **Variables**:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `ANTHROPIC_API_KEY=sk-ant-...`
   - `OPENAI_API_KEY=sk-...`
   - `GEMINI_API_KEY=...`
   - `HUGGINGFACE_API_KEY=...`
5. Deploy:
   ```bash
   railway up
   ```

---

## 3. Deploying to Fly.io

Fly.io runs applications on edge microVMs close to users worldwide.

1. Install the `flyctl` CLI:
   ```bash
   brew install flyctl
   fly auth login
   ```
2. Initialize the Fly application:
   ```bash
   fly launch --dockerfile packages/jaggu-server/Dockerfile --no-deploy
   ```
3. Set your production secrets securely:
   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ant-... OPENAI_API_KEY=sk-... GEMINI_API_KEY=...
   ```
4. Deploy the application:
   ```bash
   fly deploy
   ```

---

## 4. Deploying to Google Cloud Run

Cloud Run provides fully managed serverless containers with automated scale-to-zero.

1. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Build and submit container image via Cloud Build:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/jaggu-server -f packages/jaggu-server/Dockerfile .
   ```
3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy jaggu-server \
     --image gcr.io/YOUR_PROJECT_ID/jaggu-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 3000 \
     --set-env-vars="NODE_ENV=production" \
     --set-secrets="OPENAI_API_KEY=openai-key:latest,ANTHROPIC_API_KEY=anthropic-key:latest"
   ```

---

## 5. Security & Verification Checklist

- [x] **Non-Root Execution**: Container executes as unprivileged user `node` (`UID 1000`).
- [x] **Secret Isolation**: `.env` is strictly excluded in `.dockerignore` and `.gitignore`.
- [x] **Built-in Health Checks**: Container monitors `/health` endpoint every 30s.
- [x] **Rate Limiting & Memory Bounds**: Built-in 60 RPM sliding window rate limiter protects upstream endpoints.
- [x] **Zero Upstream Secret Exposure**: The proxy validates and handles client requests without leaking upstream provider keys in errors or headers.
