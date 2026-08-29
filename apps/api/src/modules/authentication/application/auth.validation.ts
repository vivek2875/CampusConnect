import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M}' -]+$/u, 'Use letters, spaces, apostrophes, or hyphens only.');
const password = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.');
const tenantSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const email = z.string().trim().toLowerCase().email().max(320);
const opaqueToken = z.string().min(32).max(200);

export const registerSchema = z.object({
  body: z
    .object({
      tenantSlug,
      firstName: name,
      lastName: name,
      email,
      password,
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const loginSchema = z.object({
  body: z.object({ tenantSlug, email, password: z.string().min(1).max(128) }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const verifyEmailSchema = z.object({
  body: z.object({ token: opaqueToken }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ tenantSlug, email }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const resetPasswordSchema = z.object({
  body: z.object({ token: opaqueToken, password }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const updateProfileSchema = z.object({
  body: z.object({ firstName: name, lastName: name }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const sessionIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i) }).strict(),
  query: z.object({}).strict(),
});

export const sessionListSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().min(1).max(200).optional(),
    })
    .strict(),
});
