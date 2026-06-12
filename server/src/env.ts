import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-4.1'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-12-01-preview'),
  PORT: z.coerce.number().default(8787),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = Env.parse(process.env);
