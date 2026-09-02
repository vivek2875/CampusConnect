import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { asyncHandler } from '../../../shared/http/async-handler';
import { aiRateLimit } from '../../../shared/http/rate-limit';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { aiService } from '../application/ai.service';
import { assistantSchema, priceEstimateSchema } from '../application/ai.validation';
export const aiRouter = Router();
aiRouter.post(
  '/ai/assistant',
  requireAuth,
  requireCsrf,
  aiRateLimit,
  validate(assistantSchema),
  asyncHandler(async (request, response) => {
    const messages = request.body.messages ?? [{ role: 'user' as const, content: request.body.question }];
    response.status(200).json({ data: await aiService.answer({ messages }) });
  }),
);
aiRouter.post(
  '/ai/marketplace/price-estimate',
  requireAuth,
  requireCsrf,
  aiRateLimit,
  validate(priceEstimateSchema),
  asyncHandler(async (request, response) => {
    response.status(200).json({ data: await aiService.estimatePrice(request.body) });
  }),
);
