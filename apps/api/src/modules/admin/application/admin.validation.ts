import { z } from 'zod';

import { userRoles } from '../../users/domain/user.types';

export const listAdminUsersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      role: z.enum(userRoles).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().min(1).max(200).optional(),
    })
    .strict(),
});
