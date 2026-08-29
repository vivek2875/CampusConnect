import type { RequestHandler } from 'express';

import type { UserRole } from '../../modules/users/domain/user.types';
import { AppError } from '../errors/app-error';

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      return next(new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'You do not have permission to do this.' }));
    }

    return next();
  };
}
