import { ensureDefaultTenant } from '../modules/tenants/application/tenant-bootstrap';
import { logger } from '../observability/logger';
import { connectMongo, disconnectMongo } from '../shared/persistence/mongo';

async function seedTenant(): Promise<void> {
  await connectMongo();
  const tenant = await ensureDefaultTenant();
  logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Tenant is ready');
  await disconnectMongo();
}

void seedTenant().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Tenant seed failed');
  await disconnectMongo();
  process.exit(1);
});
