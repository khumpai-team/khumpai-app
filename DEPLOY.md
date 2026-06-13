# Deploying Khumpai (Azure)

The app deploys as **one container**: the Express API serves both `/api/*` and the
built React SPA (single origin — the Vite dev proxy does not exist in production).

## Architecture in prod
```
[ Azure Container App ]  node:22, port 8787
   ├── /api/*        → Express (data + Azure OpenAI proxy)
   └── /* (SPA)      → static dist/ (built front-end)
            │
            ├── Azure Database for PostgreSQL (Flexible Server)   [DATABASE_URL]
            └── Azure OpenAI (gpt-5.4-mini)                        [AZURE_OPENAI_*]
   (optional) App Insights [APPLICATIONINSIGHTS_CONNECTION_STRING] · Content Safety [CONTENT_SAFETY_*]
```

## 1. Provision (one-time)
- **Azure Database for PostgreSQL — Flexible Server.** Create a DB `khumpai`. Build the
  connection string **with SSL**: `postgres://<user>:<pwd>@<host>:5432/khumpai?sslmode=require`.
  (The local `docker-compose.yml` is dev-only — `pgvector/pgvector:pg16`, trust auth on 5433.
  Prod uses real auth + SSL.)
- **Enable the `vector` (pgvector) extension.** The RAG knowledge base needs it. On Flexible
  Server, add `vector` to the **`azure.extensions`** server parameter (Server parameters →
  `azure.extensions` → check `VECTOR` → save), then restart if prompted. The ingest step runs
  `CREATE EXTENSION vector` and will fail if it isn't allowlisted.
- **Azure OpenAI embedding deployment.** Create a `text-embedding-3-small` deployment on the
  same Azure OpenAI resource (one `az cognitiveservices account deployment create …`). Note its
  deployment name for `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. Without it, RAG still works but
  retrieval is **lexical-only** (no semantic search).
- *(optional)* Application Insights → copy its **connection string**.
- *(optional)* Azure AI Content Safety → copy **endpoint + key**.

## 2. Migrate + seed + ingest the prod DB (one-time)
From `server/`, pointed at the **prod** DB (the `docs/rag-docs/` PDFs must be present locally —
ingest reads them from `../docs/rag-docs`, they are NOT shipped in the container image):
```bash
DATABASE_URL='postgres://…?sslmode=require' npm run db:migrate
# demo data (optional):
DATABASE_URL='postgres://…?sslmode=require' npm run db:seed
# load the RAG knowledge base from the PDFs (extract → chunk → embed → pgvector):
DATABASE_URL='postgres://…?sslmode=require' \
AZURE_OPENAI_ENDPOINT='https://<resource>.cognitiveservices.azure.com/' \
AZURE_OPENAI_API_KEY='<key>' \
AZURE_OPENAI_EMBEDDING_DEPLOYMENT='text-embedding-3-small' \
  npm run db:ingest
# Prints a per-doc chunk summary and "embeddings=yes" when the deployment is set.
# If you skip db:ingest, /api/rag/ask returns the "ask your doctor" fallback for everything.
```

## 3. Build + deploy the container
Simplest (Azure builds the Dockerfile remotely and deploys):
```bash
az containerapp up \
  --name khumpai --resource-group <rg> \
  --source . --target-port 8787 --ingress external \
  --env-vars \
    DATABASE_URL='postgres://…?sslmode=require' \
    AZURE_OPENAI_ENDPOINT='https://<resource>.cognitiveservices.azure.com/' \
    AZURE_OPENAI_DEPLOYMENT='gpt-5.4-mini' \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT='text-embedding-3-small' \
    AZURE_OPENAI_API_VERSION='2025-04-01-preview' \
    ALLOWED_ORIGIN='*'
# Put secrets as secretrefs, not plain env:
#   --secrets openai-key=<KEY> --env-vars AZURE_OPENAI_API_KEY=secretref:openai-key
```
Add `APPLICATIONINSIGHTS_CONNECTION_STRING=…` and `CONTENT_SAFETY_ENDPOINT/KEY=…` to
`--env-vars` to light up observability + input moderation.

Or build/push manually:
```bash
docker build -t <registry>/khumpai:latest .
docker push <registry>/khumpai:latest
az containerapp create --name khumpai --resource-group <rg> \
  --image <registry>/khumpai:latest --target-port 8787 --ingress external --env-vars …
```

## 4. Verify
- `https://<app-url>/api/health` → `{"ok":true}`
- Open `https://<app-url>/` → the SPA loads, hydrates from `/api/state`, chat hits the real model.

## Notes
- **Provider:** the image bakes `VITE_AGENT_PROVIDER=foundry` at build, so prod uses the
  real Azure model (no mock). The deterministic safety guardrails still run client-side.
- **Secrets:** never bake keys into the image — pass them as Container App secrets/env.
  `server/.env` and root `.env` are gitignored and `.dockerignore`d.
- **Single origin:** CORS isn't needed in prod (same host); `ALLOWED_ORIGIN` is harmless to set.
- **Backlog before scale:** code-split the 558 kB JS bundle; the App Insights token/`cached_tokens`
  logging follow-up; see the optimization backlog in the latest commit messages.
