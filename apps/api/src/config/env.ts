import 'dotenv/config';

import { z } from 'zod';

const booleanFromEnvironment = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalEnvironmentValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().url(),
    CLIENT_ORIGIN: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('15m'),
    REFRESH_TOKEN_PEPPER: z.string().min(32),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SECURE: booleanFromEnvironment.default('false'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    DEFAULT_TENANT_SLUG: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    SEED_TENANT_NAME: z.string().trim().min(3).max(120).default('CampusConnect Demo Campus'),
    SEED_TENANT_DOMAIN: z.string().trim().toLowerCase().max(253).default('campusconnect.example'),
    SMTP_URL: optionalEnvironmentValue(z.string().url()),
    MAIL_FROM: z.string().trim().min(3).max(320).default('CampusConnect <no-reply@campusconnect.example>'),
    CLOUDINARY_CLOUD_NAME: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_API_KEY: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_API_SECRET: optionalEnvironmentValue(z.string().trim().min(1)),
    GEMINI_API_KEY: optionalEnvironmentValue(z.string().trim().min(1)),
    GEMINI_MODEL: z.string().trim().min(1).max(100).default('gemini-3.6-flash'),
    VAPID_SUBJECT: optionalEnvironmentValue(
      z
        .string()
        .trim()
        .regex(/^(mailto:|https:\/\/)/),
    ),
    VAPID_PUBLIC_KEY: optionalEnvironmentValue(z.string().trim().min(32)),
    VAPID_PRIVATE_KEY: optionalEnvironmentValue(z.string().trim().min(32)),
    EVENT_TICKET_SECRET: z.string().min(32),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production.',
      });
    }

    if (value.NODE_ENV === 'production' && !value.SMTP_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_URL'],
        message: 'SMTP_URL is required in production.',
      });
    }

    const cloudinaryValues = [value.CLOUDINARY_CLOUD_NAME, value.CLOUDINARY_API_KEY, value.CLOUDINARY_API_SECRET];
    if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLOUDINARY_CLOUD_NAME'],
        message: 'Configure all Cloudinary variables together or leave them all unset.',
      });
    }

    const pushValues = [value.VAPID_SUBJECT, value.VAPID_PUBLIC_KEY, value.VAPID_PRIVATE_KEY];
    if (pushValues.some(Boolean) && !pushValues.every(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VAPID_PUBLIC_KEY'],
        message: 'Configure all VAPID variables together or leave them all unset.',
      });
    }
  });

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error('Invalid environment configuration:', parsedEnvironment.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnvironment.data;
