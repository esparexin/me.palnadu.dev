import {passwordProblems} from '@me-palnadu/contracts';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import type {PrismaService} from '../../prisma/prisma.service.js';
import {hashPassword, verifyPassword} from '../../auth/password.js';

/**
 * Changes the password and invalidates every existing session.
 *
 * `tokenVersion` is incremented in the same transaction as the hash write. Keeping
 * a session alive after the credential it came from has changed is what makes a
 * password change feel broken, and it leaves a stolen token usable until it expires.
 */
export const changeAdminPassword = async (
  prisma: PrismaService,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  let admin: {id: string; email: string; passwordHash: string; tokenVersion: number} | null;
  try {
    admin = await prisma.adminUser.findUnique({where: {id: userId}});
  } catch (error) {
    throw mapPersistenceError(error).error;
  }
  if (admin === null) throw ApiError.unauthenticated('The session token is not valid.');
  if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
    throw ApiError.unauthenticated('The current password is not correct.');
  }

  const problems = passwordProblems(newPassword, admin.email);
  if (problems.length > 0) {
    throw ApiError.validationFailed(
      'The new password does not meet the policy.',
      problems.map((problem) => ({path: 'newPassword', message: problem})),
    );
  }

  const targetAdmin = admin;
  const passwordHash = await hashPassword(newPassword);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: {id: targetAdmin.id},
        data: {passwordHash, tokenVersion: {increment: 1}},
      });
      await tx.auditLog.create({
        data: {
          actorId: targetAdmin.id,
          action: 'auth_password_change',
          entityType: 'admin',
          entityId: targetAdmin.id,
        },
      });
    });
  } catch (error) {
    throw mapPersistenceError(error).error;
  }
};
