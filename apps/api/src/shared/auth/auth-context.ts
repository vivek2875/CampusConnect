import type { UserRole } from '../../modules/users/domain/user.types';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  sessionId: string;
  authVersion: number;
  emailVerified: boolean;
}
