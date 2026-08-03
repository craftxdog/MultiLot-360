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
  membresias_tenant: {
    where: { estado: 'ACTIVO' as const, eliminado_en: null },
    take: 1,
    include: {
      tenants: true,
      vendedores: true,
      roles: {
        include: {
          permisos_por_rol: {
            include: {
              modulos: true,
            },
          },
        },
      },
    },
  },
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
): PermissionKey => `${moduleCode.toLowerCase()}.${action}`;

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
    const membership = user.membresias_tenant[0];
    if (!membership) {
      throw new Error('Active tenant membership is required');
    }
    const seller = membership.vendedores;
    const permissionRows = membership.roles.permisos_por_rol;
    const modules = [
      ...new Set(
        permissionRows
          .filter((permission) =>
            PERMISSION_ACTIONS.some(({ field }) => permission[field]),
          )
          .map((permission) => permission.modulos.codigo.toLowerCase()),
      ),
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
        id: membership.roles.id,
        name: membership.roles.nombre,
      },
      modules,
      permissions,
      tenant: {
        id: membership.tenants.id,
        slug: membership.tenants.slug,
        name: membership.tenants.nombre,
        membershipId: membership.id,
        isOwner: membership.es_propietario,
      },
      ...(seller && {
        seller: {
          id: seller.id,
          userId: seller.usuario_id,
          name: seller.nombre,
          active: seller.activo,
        },
      }),
    };
  }
}
