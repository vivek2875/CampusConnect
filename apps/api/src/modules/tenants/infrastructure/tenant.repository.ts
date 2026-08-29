import { TenantModel, type TenantDocument } from './tenant.model';

export type { TenantDocument } from './tenant.model';

export const tenantRepository = {
  findActiveBySlug(slug: string): Promise<TenantDocument | null> {
    return TenantModel.findOne({ slug, status: 'active' }).exec();
  },

  async createIfMissing(input: { name: string; slug: string; allowedEmailDomain: string }): Promise<TenantDocument> {
    return TenantModel.findOneAndUpdate(
      { slug: input.slug },
      {
        $setOnInsert: {
          name: input.name,
          slug: input.slug,
          allowedEmailDomains: [input.allowedEmailDomain.toLowerCase()],
          status: 'active',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  },
};
