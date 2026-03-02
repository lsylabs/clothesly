import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend-local env first, then optional repo-root env for convenience.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;

const required = [{ key: 'SUPABASE_URL', value: supabaseUrl }];

for (const requirement of required) {
  if (!requirement.value) {
    throw new Error(`Missing required environment variable: ${requirement.key}`);
  }
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl,
  supabaseJwtAudience: process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? '*'
};
