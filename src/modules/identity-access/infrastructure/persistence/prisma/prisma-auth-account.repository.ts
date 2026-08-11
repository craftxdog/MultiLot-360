import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TenantContextService,
  TenantExecutionContextService,
} from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  AuthAccountRepository,
  CreateInternalUserInput,
  IdentityUser,
  PermissionAction,
  PermissionKey,
} from '../../../domain';

const MANAGED_PASSWORD_HASH = 'supabase:managed';

const legacyIdentityUserInclude = {
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

type LegacyIdentityUserRecord = Prisma.usuariosGetPayload<{
  include: typeof legacyIdentityUserInclude;
}>;

const tenantIdentityUserInclude = {
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

type TenantIdentityUserRecord = Prisma.usuariosGetPayload<{
  include: typeof tenantIdentityUserInclude;
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
export class PrismaAuthAccountRepository implements AuthAccountRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantExecution: TenantExecutionContextService,
  ) {}

  async createInternalUser(
    input: CreateInternalUserInput,
  ): Promise<IdentityUser> {
    const role = await this.prisma.roles.findFirst({
      where: {
        nombre: input.roleName,
      },
    });

    if (!role) {
      throw new Error(`Role "${input.roleName}" does not exist`);
    }

    const user = await this.prisma.usuarios.create({
      data: {
        auth_user_id: input.authUserId,
        username: input.username,
        pass_hash: MANAGED_PASSWORD_HASH,
        rol_id: role.id,
        nombre: input.name,
        activo: true,
      },
      include: legacyIdentityUserInclude,
    });

    return this.mapLegacyUser(user);
  }

  async findByAuthUserId(
    authUserId: string,
    tenantSelector?: string,
  ): Promise<IdentityUser | null> {
    if (!this.prisma.hasRequestTransaction()) {
      return this.prisma.runInRequestTransaction(() =>
        this.tenantExecution.run(async () => {
          try {
            await this.tenantContext.activateForAuthentication(
              authUserId,
              tenantSelector,
            );
          } catch {
            return null;
          }
          return this.findTenantUserByAuthUserId(authUserId);
        }),
      );
    }

    return this.findTenantUserByAuthUserId(authUserId);
  }

  async findById(userId: string): Promise<IdentityUser | null> {
    const user = await this.prisma.usuarios.findUnique({
      where: { id: userId },
      include: tenantIdentityUserInclude,
    });

    return user ? this.mapTenantUser(user) : null;
  }

  private async findTenantUserByAuthUserId(
    authUserId: string,
  ): Promise<IdentityUser | null> {
    const user = await this.prisma.usuarios.findFirst({
      where: {
        auth_user_id: authUserId,
        membresias_tenant: {
          some: { estado: 'ACTIVO', eliminado_en: null },
        },
      },
      include: tenantIdentityUserInclude,
    });

    return user ? this.mapTenantUser(user) : null;
  }

  private mapLegacyUser(user: LegacyIdentityUserRecord): IdentityUser {
    const seller = user.vendedores[0];
    const permissionRows = user.roles.permisos_por_rol;
    const modules = [
      ...new Set(
        permissionRows.map((permission) =>
          permission.modulos.codigo.toLowerCase(),
        ),
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
        id: user.roles.id,
        name: user.roles.nombre,
      },
      modules,
      permissions,
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

  private mapTenantUser(user: TenantIdentityUserRecord): IdentityUser {
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
