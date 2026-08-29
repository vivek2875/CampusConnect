import type { AuthContext } from '../auth/auth-context';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
