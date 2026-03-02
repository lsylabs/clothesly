# Clothesly BFF (Milestone 5)

Thin Express backend for privileged workflows and future orchestration.

## Endpoints

- `GET /health` - service liveness check
- `POST /v1/items` - authenticated create item metadata row (DB)
- `POST /v1/items/:id/finalize` - authenticated finalize item with primary path, extra image rows, and closet mappings
- `DELETE /v1/items/:id` - authenticated delete of item row plus storage object cleanup
- `POST /v1/uploads/sign` - authenticated scaffold for future signed-upload orchestration
- `GET /v1/internal/ping` - authenticated internal test route
- `POST /v1/internal/ai/outfit-generate` - authenticated scaffold for future AI pipeline

## Setup

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL` to your project URL.
3. Set `SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY`) for REST/storage API calls.
4. Optional: adjust `PORT` and `ALLOWED_ORIGINS`.

## Run

```bash
cd backend
npm install
npm run dev
```

## Auth

Protected routes require `Authorization: Bearer <supabase-access-token>`.
Tokens are verified against Supabase JWKS: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
