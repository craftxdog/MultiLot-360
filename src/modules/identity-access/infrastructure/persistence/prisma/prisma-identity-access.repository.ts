import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  IdentityAccessRepository,
  IdentityUser,
  PermissionAction,
  PermissionKey,
} from '../../../domain';

const identityUserInclude = {
  roles: {
    include: {
      permisos_por_rol: {
        include: {
          modulos: true,
        },
      },
    },
  },
  vendedores: true,
} satisfies Prisma.usuariosInclude;

type IdentityUserRecord = Prisma.usuariosGetPayload<{
  include: typeof identityUserInclude;
}>;

const PERMISSION_ACTIONS: Array<{
  field: 'puede_leer' | 'puede_crear' | 'puede_actualizar' | 'puede_borrar';
  action: PermissionAction;
}> = [
  { field: 'puede_leer', action: 'read' },
  { field: 'puede_crear', action: 'create' },
  { field: 'puede_actualizar', action: 'update' },
  { field: 'puede_borrar', action: 'delete' },
];

const buildPermissionKey = (
  moduleCode: string,
  action: PermissionAction,
): PermissionKey => `${moduleCode}.${action}`;

@Injectable()
export class PrismaIdentityAccessRepository implements IdentityAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAuthUserId(authUserId: string): Promise<IdentityUser | null> {
    const user = await this.prisma.usuarios.findUnique({
      where: {
        auth_user_id: authUserId,
      },
      include: identityUserInclude,
    });

    return user ? this.mapUser(user) : null;
  }

  private mapUser(user: IdentityUserRecord): IdentityUser {
    const permissionRows = user.roles.permisos_por_rol;
    const modules = [
      ...new Set(permissionRows.map((permission) => permission.modulos.codigo)),
    ];
    const permissions = [
      ...new Set<PermissionKey>(
        permissionRows.flatMap((permission) =>
          PERMISSION_ACTIONS.filter(({ field }) => permission[field]).map(
            ({ action }) =>
              buildPermissionKey(permission.modulos.codigo, action),
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      authUserId: user.auth_user_id ?? '',
      username: user.username,
      name: user.nombre,
      active: user.activo,
      role: {
        id: user.roles.id,
        name: user.roles.nombre,
      },
      modules,
      permissions,
      ...(user.vendedores && {
        seller: {
          id: user.vendedores.id,
          userId: user.vendedores.usuario_id,
          name: user.vendedores.nombre,
          active: user.vendedores.activo,
        },
      }),
    };
  }
}
