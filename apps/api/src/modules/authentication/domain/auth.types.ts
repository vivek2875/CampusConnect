import type { PublicUser, UserRole } from '../../users/domain/user.types';

export interface AccessTokenClaims {
  userId: string;
  tenantId: string;
  role: UserRole;
  sessionId: string;
  authVersion: number;
}

export interface AuthenticationResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  session: {
    id: string;
    expiresAt: Date;
  };
}
