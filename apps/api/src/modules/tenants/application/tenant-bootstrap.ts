import { env } from '../../../config/env';
import { tenantRepository, type TenantDocument } from '../infrastructure/tenant.repository';

/** Ensures the configured tenant exists for a new local or demonstration environment. */
export function ensureDefaultTenant(): Promise<TenantDocument> {
  return tenantRepository.createIfMissing({
    name: env.SEED_TENANT_NAME,
    slug: env.DEFAULT_TENANT_SLUG,
    allowedEmailDomain: env.SEED_TENANT_DOMAIN,
  });
}
