export const userRoles = ['student', 'faculty', 'maintenance_staff', 'admin', 'super_admin'] as const;
export type UserRole = (typeof userRoles)[number];

export type UserStatus = 'active' | 'suspended';

export interface PublicUser {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
}
