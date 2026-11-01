/* eslint-disable @typescript-eslint/no-namespace */
import { Request } from 'express';
import { User, Role, UserProfile, WorkerProfile } from '@prisma/client';

export type UserWithRoleAndProfiles = User & {
  role: Role;
  profile: UserProfile | null;
  workerProfile: WorkerProfile | null;
};

export interface ClerkAuthInfo {
  clerkId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserWithRoleAndProfiles;
      clerkAuth?: ClerkAuthInfo;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: UserWithRoleAndProfiles;
}
