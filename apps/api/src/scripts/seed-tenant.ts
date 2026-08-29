import { env } from '../config/env';
import { tenantRepository } from '../modules/tenants/infrastructure/tenant.repository';
import { logger } from '../observability/logger';
import { connectMongo, disconnectMongo } from '../shared/persistence/mongo';

async function seedTenant(): Promise<void> {
  await connectMongo();
  const tenant = await tenantRepository.createIfMissing({
    name: env.SEED_TENANT_NAME,
    slug: env.DEFAULT_TENANT_SLUG,
    allowedEmailDomain: env.SEED_TENANT_DOMAIN,
  });
  logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Tenant is ready');
  await disconnectMongo();
}

void seedTenant().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Tenant seed failed');
  await disconnectMongo();
  process.exit(1);
});
