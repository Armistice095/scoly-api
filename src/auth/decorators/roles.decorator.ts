import { SetMetadata } from '@nestjs/common';
import type { RoleUtilisateur } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Pose sur une route les rôles autorisés à l'appeler. Sans ce décorateur, RolesGuard laisse passer tout le monde. */
export const Roles = (...roles: RoleUtilisateur[]) =>
  SetMetadata(ROLES_KEY, roles);
