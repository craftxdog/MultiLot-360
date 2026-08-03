import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  AccessControlRepository,
  ReplaceRolePermissionsInput,
} from '../../../domain/ports';
import {
  AccessModule,
  AccessPermission,
  AccessRole,
  AccessUserRole,
} from '../../../domain/entities';

const roleInclude = {
  permisos_por_rol: {
    include: { modulos: true },
  },
  _count: {
    select: { membresias_tenant: true },
  },
} satisfies Prisma.rolesInclude;

type RoleRecord = Prisma.rolesGetPayload<{ include: typeof roleInclude }>;
type ModuleRecord = Prisma.modulosGetPayload<{
  include: { _count: { select: { permisos_por_rol: true } } };
}>;

@Injectable()
export class PrismaAccessControlRepository implements AccessControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listModules(search?: string): Promise<AccessModule[]> {
    const modules = await this.prisma.modulos.findMany({
      where: search
        ? {
            OR: [
              { codigo: { contains: search, mode: 'insensitive' } },
              { descripcion: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { _count: { select: { permisos_por_rol: true } } },
      orderBy: { codigo: 'asc' },
    });

    return modules.map((module) => this.mapModule(module));
  }

  async listRoles(search?: string): Promise<AccessRole[]> {
    const [roles, modules] = await this.prisma.$transaction([
      this.prisma.roles.findMany({
        where: search
          ? { nombre: { contains: search, mode: 'insensitive' } }
          : undefined,
        include: roleInclude,
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.modulos.findMany({ orderBy: { codigo: 'asc' } }),
    ]);

    return roles.map((role) => this.mapRole(role, modules));
  }

  async getRole(roleId: string): Promise<AccessRole | null> {
    const [role, modules] = await this.prisma.$transaction([
      this.prisma.roles.findUnique({
        where: { id: roleId },
        include: roleInclude,
      }),
      this.prisma.modulos.findMany({ orderBy: { codigo: 'asc' } }),
    ]);

    return role ? this.mapRole(role, modules) : null;
  }

  async createRole(name: string): Promise<AccessRole> {
    try {
      const role = await this.prisma.roles.create({ data: { nombre: name } });
      const created = await this.getRole(role.id);
      if (!created) throw new Error('Created role could not be loaded');
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(`Role "${name}" already exists`);
      }
      throw error;
    }
  }

  async replaceRolePermissions(
    input: ReplaceRolePermissionsInput,
  ): Promise<AccessRole> {
    const [role, modules] = await this.prisma.$transaction([
      this.prisma.roles.findUnique({ where: { id: input.roleId } }),
      this.prisma.modulos.findMany(),
    ]);
    if (!role) throw new Error('Role not found');

    const modulesByCode = new Map(
      modules.map((module) => [module.codigo.toUpperCase(), module]),
    );
    const normalized = input.permissions.map((permission) => ({
      ...permission,
      moduleCode: permission.moduleCode.trim().toUpperCase(),
    }));
    const unknown = normalized.find(
      (permission) => !modulesByCode.has(permission.moduleCode),
    );
    if (unknown) throw new Error(`Module "${unknown.moduleCode}" not found`);

    if (role.nombre.toUpperCase() === 'ADMIN') {
      this.assertAdminRetainsManagement(normalized);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.permisos_por_rol.deleteMany({ where: { rol_id: role.id } });
      const activePermissions = normalized.filter((permission) =>
        this.hasAnyPermission(permission),
      );
      if (activePermissions.length > 0) {
        await tx.permisos_por_rol.createMany({
          data: activePermissions.map((permission) => ({
            rol_id: role.id,
            modulo_id: modulesByCode.get(permission.moduleCode)!.id,
            puede_leer: permission.canRead,
            puede_crear: permission.canCreate,
            puede_actualizar: permission.canUpdate,
            puede_borrar: permission.canDelete,
          })),
        });
      }
    });

    const updated = await this.getRole(role.id);
    if (!updated) throw new Error('Updated role could not be loaded');
    return updated;
  }

  async assignUserRole(
    userId: string,
    roleId: string,
  ): Promise<AccessUserRole> {
    const membership = await this.prisma.membresias_tenant.findFirst({
      where: { perfil_id: userId, eliminado_en: null },
      include: { usuarios: true },
    });
    if (!membership) throw new Error('User not found');

    const role = await this.prisma.roles.findFirst({
      where: { id: roleId, tenant_id: membership.tenant_id },
    });
    if (!role) throw new Error('Role not found');

    const updated = await this.prisma.membresias_tenant.update({
      where: { id: membership.id },
      data: { rol_id: role.id, actualizado_en: new Date() },
      include: { roles: true, usuarios: true },
    });

    return {
      userId: updated.perfil_id,
      username: updated.username,
      name: updated.usuarios.nombre,
      roleId: updated.roles.id,
      roleName: updated.roles.nombre,
      updatedAt: updated.actualizado_en,
    };
  }

  private mapModule(module: ModuleRecord): AccessModule {
    return {
      id: module.id,
      code: module.codigo,
      description: module.descripcion,
      roleCount: module._count.permisos_por_rol,
    };
  }

  private mapRole(
    role: RoleRecord,
    modules: Array<{ id: string; codigo: string; descripcion: string | null }>,
  ): AccessRole {
    const byModuleId = new Map(
      role.permisos_por_rol.map((permission) => [
        permission.modulo_id,
        permission,
      ]),
    );
    return {
      id: role.id,
      name: role.nombre,
      createdAt: role.creado_en,
      userCount: role._count.membresias_tenant,
      permissions: modules.map((module): AccessPermission => {
        const permission = byModuleId.get(module.id);
        return {
          moduleId: module.id,
          moduleCode: module.codigo,
          moduleDescription: module.descripcion,
          canRead: permission?.puede_leer ?? false,
          canCreate: permission?.puede_crear ?? false,
          canUpdate: permission?.puede_actualizar ?? false,
          canDelete: permission?.puede_borrar ?? false,
        };
      }),
    };
  }

  private hasAnyPermission(permission: {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }): boolean {
    return (
      permission.canRead ||
      permission.canCreate ||
      permission.canUpdate ||
      permission.canDelete
    );
  }

  private assertAdminRetainsManagement(
    permissions: ReplaceRolePermissionsInput['permissions'],
  ): void {
    for (const requiredCode of ['ROLES', 'PARAMETROS']) {
      const permission = permissions.find(
        (candidate) => candidate.moduleCode === requiredCode,
      );
      if (!permission?.canRead || !permission.canUpdate) {
        throw new Error(
          `ADMIN must retain read and update access to ${requiredCode}`,
        );
      }
    }
  }
}
