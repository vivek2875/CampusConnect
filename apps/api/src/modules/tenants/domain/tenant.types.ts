export type TenantStatus = 'active' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  allowedEmailDomains: string[];
  status: TenantStatus;
}
