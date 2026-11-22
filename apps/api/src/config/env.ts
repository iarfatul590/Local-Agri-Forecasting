import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use PostgreSQL",
  ),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:8081"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_PROVIDER: z.enum(["console", "sms"]).default("console"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = result.data;
export const webOrigins = env.WEB_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

export function isAllowedWebOrigin(origin?: string): boolean {
  if (!origin || webOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return url.protocol === "http:"
      && !url.username
      && !url.password
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
