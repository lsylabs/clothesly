# Supabase Milestone 2 Setup

This folder contains SQL migrations for the MVP data layer.

## Files

- `migrations/20260302000000_milestone2_schema.sql`
  - Tables: `profiles`, `closets`, `clothing_items`, `clothing_item_images`, `clothing_item_closets`
  - Constraints, indexes, `updated_at` trigger, and auth-user profile bootstrap trigger
  - Row-level security policies for all app tables
- `migrations/20260302000001_storage_policies.sql`
  - Buckets: `avatars`, `closets`, `items`
  - Storage object policies scoped by first folder segment = `auth.uid()`

## Apply in Supabase

1. Open your Supabase project SQL editor.
2. Run `20260302000000_milestone2_schema.sql`.
3. Run `20260302000001_storage_policies.sql`.
4. Confirm tables and buckets exist.
5. Confirm RLS is enabled on app tables.

## Expected storage path conventions

- Avatars bucket `avatars`: `{userId}/{fileId}.{ext}`
- Closet covers bucket `closets`: `{userId}/{closetId}/{fileId}.{ext}`
- Item primary image bucket `items`: `{userId}/{itemId}/primary/{fileId}.{ext}`
- Item extra image bucket `items`: `{userId}/{itemId}/extra/{fileId}.{ext}`

