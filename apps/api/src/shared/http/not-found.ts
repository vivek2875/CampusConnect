import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: `No route matches ${request.method} ${request.originalUrl}.`,
    }),
  );
};
