import type {Role} from '@me-palnadu/contracts';

/** The authenticated administrator, resolved from the database on every request. */
export interface AuthenticatedAdmin {
  id: string;
  githubId: number;
  login: string;
  role: Role;
  sessionId: string;
}

/** Adds the resolved principal to the request. */
export interface RequestWithAdmin {
  admin?: AuthenticatedAdmin;
}
