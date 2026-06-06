/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

export const configSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
  VITE_ENVIRONMENT: z.enum(['development', 'production', 'test']).default('development'),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

let env: any = {};
if (typeof import.meta !== 'undefined' && import.meta.env) {
  env = import.meta.env;
} else if (typeof (window as any).process !== 'undefined' && (window as any).process.env) {
  env = (window as any).process.env;
}

const parseResult = configSchema.safeParse(env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:', parseResult.error.format());
  // Do not throw in browser to prevent crash, just log.
}

export const config = parseResult.success ? parseResult.data : configSchema.parse({});

