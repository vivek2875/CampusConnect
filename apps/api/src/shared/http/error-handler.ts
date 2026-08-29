import type { ErrorRequestHandler } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';

import { env } from '../../config/env';
import { logger } from '../../observability/logger';
import { AppError } from '../errors/app-error';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  let normalizedError = error;

  if (error instanceof ZodError) {
    normalizedError = new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid data.',
      details: error.flatten(),
    });
  } else if (error instanceof MongooseError.ValidationError) {
    normalizedError = new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid data.',
    });
  } else if (isMalformedJsonError(error)) {
    normalizedError = new AppError({
      statusCode: 400,
      code: 'MALFORMED_JSON',
      message: 'The request body must contain valid JSON.',
    });
  } else if (error instanceof TokenExpiredError) {
    normalizedError = new AppError({
      statusCode: 401,
      code: 'ACCESS_TOKEN_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
    });
  } else if (error instanceof JsonWebTokenError) {
    normalizedError = new AppError({
      statusCode: 401,
      code: 'INVALID_ACCESS_TOKEN',
      message: 'Authentication is invalid.',
    });
  } else if (isDuplicateKeyError(error)) {
    normalizedError = new AppError({
      statusCode: 409,
      code: 'DUPLICATE_RESOURCE',
      message: 'A resource with those details already exists.',
    });
  }

  const operationalError = normalizedError instanceof AppError && normalizedError.isOperational;
  const statusCode = operationalError ? normalizedError.statusCode : 500;
  const appError = operationalError ? normalizedError : undefined;

  if (!operationalError || statusCode >= 500) {
    logger.error({ err: normalizedError, requestId: request.id }, 'Unhandled request error');
  } else {
    logger.warn({ code: appError.code, statusCode, requestId: request.id }, appError.message);
  }

  response.status(statusCode).json({
    error: {
      code: appError?.code ?? 'INTERNAL_SERVER_ERROR',
      message: appError?.message ?? 'An unexpected error occurred.',
      ...(appError?.details ? { details: appError.details } : {}),
      requestId: request.id,
      ...(env.NODE_ENV === 'development' && !operationalError
        ? { debug: normalizedError instanceof Error ? normalizedError.message : undefined }
        : {}),
    },
  });
};

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function isMalformedJsonError(error: unknown): error is SyntaxError & { status: number; type: string } {
  return (
    error instanceof SyntaxError && 'status' in error && error.status === 400 && 'type' in error && error.type === 'entity.parse.failed'
  );
}
