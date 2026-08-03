import { Injectable } from '@nestjs/common';
import { Prisma, codigo_acceso_estado } from '@prisma/client';
import { buildOffsetPagination, getOffsetSkip } from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { PaginatedResult } from '../../../../../shared-kernel';
import {
  ConfirmSellerAccessInput,
  DeleteSellerInput,
  ListSellerInvitationsQuery,
  ListSellersQuery,
  PendingSellerAccess,
  PersistResendSellerAccessCodeInput,
  PersistSellerInvitationInput,
  RevokeSellerInvitationInput,
  SellerOnboardingRepository,
} from '../../../domain/ports';
import {
  ConfirmedSellerAccess,
  RevokedSellerInvitation,
  SellerAccessCodeStatus,
  SellerInvitation,
  SellerInvitationListItem,
  SellerDirectoryItem,
  SellerDeletionResult,
  SellerDeletionTarget,
} from '../../../domain';

const DEFAULT_SELLER_ROLE_NAME = 'vendedor';
const PENDING_PASSWORD_HASH = 'supabase:pending';

@Injectable()
export class PrismaSellerOnboardingRepository implements SellerOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSellers(
    query: ListSellersQuery,
  ): Promise<PaginatedResult<SellerDirectoryItem>> {
    const where = this.buildSellerListWhere(query);
    const orderBy = this.buildSellerListOrderBy(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendedores.findMany({
        where,
        include: {
          usuarios: true,
          membresias_tenant: { include: { roles: true } },
        },
        orderBy,
        skip: getOffsetSkip(query),
        take: query.limit,
      }),
      this.prisma.vendedores.count({ where }),
    ]);

    return buildOffsetPagination(
      items.map((item) => ({
        id: item.id,
        userId: item.usuario_id,
        username: item.usuarios.username,
        userName: item.usuarios.nombre,
        roleId: item.membresias_tenant.roles.id,
        roleName: item.membresias_tenant.roles.nombre,
        name: item.nombre,
        documentId: item.cedula,
        phone: item.telefono,
        address: item.direccion,
        active: item.activo && item.membresias_tenant.estado === 'ACTIVO',
        userActive: item.membresias_tenant.estado === 'ACTIVO',
        deletedAt: item.eliminado_en ?? item.membresias_tenant.eliminado_en,
        deletionReason: item.motivo_eliminacion,
        createdAt: item.creado_en,
        updatedAt: item.actualizado_en,
      })),
      total,
      query,
    );
  }

  async listInvitations(
    query: ListSellerInvitationsQuery,
  ): Promise<PaginatedResult<SellerInvitationListItem>> {
    const where = this.buildInvitationListWhere(query);
    const orderBy = this.buildInvitationListOrderBy(query);
    const { items, total } = await this.prisma.$transaction(async (tx) => {
      const items = await tx.codigos_acceso_vendedor.findMany({
        where,
        include: {
          usuarios: {
            select: {
              id: true,
              username: true,
            },
          },
          vendedores: {
            select: {
              id: true,
              nombre: true,
              cedula: true,
            },
          },
          creador: {
            select: {
              id: true,
              username: true,
              nombre: true,
            },
          },
        },
        orderBy,
        skip: getOffsetSkip(query),
        take: query.limit,
      });
      const total = await tx.codigos_acceso_vendedor.count({ where });

      return { items, total };
    });

    return buildOffsetPagination(
      items.map((item) => ({
        id: item.id,
        userId: item.usuario_id,
        sellerId: item.vendedor_id,
        email: item.email,
        username: item.usuarios.username,
        sellerName: item.vendedores.nombre,
        documentId: item.vendedores.cedula,
        status: this.toEffectiveStatus(item.estado, item.expira_en),
        expiresAt: item.expira_en,
        usedAt: item.usado_en,
        createdAt: item.creado_en,
        createdBy: item.creador
          ? {
              userId: item.creador.id,
              username: item.creador.username,
              name: item.creador.nombre,
            }
          : null,
      })),
      total,
      query,
    );
  }

  async findDeletionTarget(
    sellerId: string,
  ): Promise<SellerDeletionTarget | null> {
    const seller = await this.prisma.vendedores.findUnique({
      where: { id: sellerId },
      include: { usuarios: true },
    });

    return seller ? this.toDeletionTarget(seller) : null;
  }

  async softDeleteSeller(
    input: DeleteSellerInput,
  ): Promise<SellerDeletionResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const seller = await tx.vendedores.findUnique({
        where: { id: input.sellerId },
        include: { usuarios: true },
      });

      if (!seller) return null;

      const deletedAt = new Date();
      await tx.codigos_acceso_vendedor.updateMany({
        where: {
          vendedor_id: seller.id,
          estado: codigo_acceso_estado.PENDIENTE,
        },
        data: {
          estado: codigo_acceso_estado.REVOCADO,
        },
      });
      await tx.vendedores.update({
        where: { id: seller.id },
        data: {
          activo: false,
          eliminado_en: deletedAt,
          motivo_eliminacion: input.reason,
          actualizado_en: deletedAt,
        },
      });
      await tx.membresias_tenant.update({
        where: { id: seller.membresia_id },
        data: {
          estado: 'SUSPENDIDO',
          eliminado_en: deletedAt,
          actualizado_en: deletedAt,
        },
      });
      await this.recordDeletionAudit(tx, 'identity.seller.soft_deleted', {
        adminUserId: input.adminUserId,
        target: this.toDeletionTarget(seller),
        reason: input.reason,
        deletedAt: deletedAt.toISOString(),
      });

      return {
        ...this.toDeletionTarget(seller),
        mode: 'soft',
        authUserDeleted: false,
        deletedAt,
      };
    });
  }

  async hardDeleteSeller(
    input: DeleteSellerInput & { authUserDeleted: boolean },
  ): Promise<SellerDeletionResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const seller = await tx.vendedores.findUnique({
        where: { id: input.sellerId },
        include: { usuarios: true },
      });

      if (!seller) return null;

      const deletedAt = new Date();
      const target = this.toDeletionTarget(seller);
      const saleIds = (
        await tx.ventas.findMany({
          where: { vendedor_id: seller.id },
          select: { id: true },
        })
      ).map((sale) => sale.id);

      if (saleIds.length > 0) {
        throw new Error(
          'El vendedor tiene ventas históricas y sólo admite baja reversible.',
        );
      }

      await tx.limites_numero.deleteMany({
        where: { vendedor_id: seller.id },
      });
      await tx.codigos_acceso_vendedor.deleteMany({
        where: {
          OR: [
            { vendedor_id: seller.id },
            { usuario_id: seller.usuario_id },
            { creado_por: seller.usuario_id },
          ],
        },
      });
      await tx.notificaciones.deleteMany({
        where: { usuario_id: seller.usuario_id },
      });
      await tx.vendedores.delete({
        where: { id: seller.id },
      });
      await tx.membresias_tenant.update({
        where: { id: seller.membresia_id },
        data: {
          estado: 'REVOCADO',
          eliminado_en: deletedAt,
          actualizado_en: deletedAt,
        },
      });
      await this.recordDeletionAudit(tx, 'identity.seller.hard_deleted', {
        adminUserId: input.adminUserId,
        target,
        reason: input.reason,
        deletedAt: deletedAt.toISOString(),
        authUserDeleted: false,
        deletedSalesCount: saleIds.length,
      });

      return {
        ...target,
        mode: 'hard',
        authUserDeleted: false,
        deletedAt,
      };
    });
  }

  async createInvitation(
    input: PersistSellerInvitationInput,
  ): Promise<SellerInvitation> {
    const roleName = input.roleName ?? DEFAULT_SELLER_ROLE_NAME;
    const role = await this.prisma.roles.findFirst({
      where: {
        nombre: {
          equals: roleName,
          mode: 'insensitive',
        },
      },
    });

    if (!role) {
      throw new Error(`Role "${roleName}" does not exist`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.usuarios.findUnique({
          where: {
            username: input.username,
          },
          include: {
            vendedores: { where: { tenant_id: role.tenant_id } },
            membresias_tenant: { where: { tenant_id: role.tenant_id } },
          },
        });

        const existingMembership = existingUser?.membresias_tenant[0];
        const existingSeller = existingUser?.vendedores[0];

        if (existingMembership?.estado === 'ACTIVO') {
          throw new Error(`User "${input.username}" is already active`);
        }

        if (existingMembership && !existingSeller) {
          throw new Error(`User "${input.username}" is not a seller`);
        }

        const user = existingUser
          ? existingUser
          : await tx.usuarios.create({
              data: {
                username: input.username,
                pass_hash: PENDING_PASSWORD_HASH,
                rol_id: role.id,
                activo: false,
                nombre: input.sellerName,
              },
            });

        const membership = await tx.membresias_tenant.upsert({
          where: {
            tenant_id_perfil_id: {
              tenant_id: role.tenant_id,
              perfil_id: user.id,
            },
          },
          create: {
            tenant_id: role.tenant_id,
            perfil_id: user.id,
            rol_id: role.id,
            username: input.username,
            estado: 'INVITADO',
          },
          update: {
            rol_id: role.id,
            username: input.username,
            estado: 'INVITADO',
            eliminado_en: null,
          },
        });

        const seller = existingSeller
          ? await tx.vendedores.update({
              where: {
                id: existingSeller.id,
              },
              data: {
                nombre: input.sellerName,
                cedula: input.documentId,
                telefono: input.phone,
                direccion: input.address,
                activo: false,
              },
            })
          : await tx.vendedores.create({
              data: {
                tenant_id: role.tenant_id,
                membresia_id: membership.id,
                usuario_id: user.id,
                nombre: input.sellerName,
                cedula: input.documentId,
                telefono: input.phone,
                direccion: input.address,
                activo: false,
              },
            });

        const actorMembership = input.adminUserId
          ? await tx.membresias_tenant.findUnique({
              where: {
                tenant_id_perfil_id: {
                  tenant_id: role.tenant_id,
                  perfil_id: input.adminUserId,
                },
              },
              select: { id: true },
            })
          : null;

        await tx.codigos_acceso_vendedor.updateMany({
          where: {
            OR: [{ email: input.email }, { usuario_id: user.id }],
            estado: codigo_acceso_estado.PENDIENTE,
          },
          data: {
            estado: codigo_acceso_estado.REVOCADO,
          },
        });

        await tx.codigos_acceso_vendedor.create({
          data: {
            tenant_id: role.tenant_id,
            usuario_id: user.id,
            vendedor_id: seller.id,
            email: input.email,
            codigo_hash: input.accessCodeHash,
            enlace_token_hash: input.actionTokenHash,
            expira_en: input.expiresAt,
            creado_por: input.adminUserId,
            creado_por_membresia_id: actorMembership?.id,
          },
        });

        return {
          userId: user.id,
          sellerId: seller.id,
          email: input.email,
          sellerName: seller.nombre,
          expiresAt: input.expiresAt,
        };
      });
    } catch (error) {
      throw this.toInvitationError(error);
    }
  }

  private toInvitationError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const fields = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : 'unique field';

        return new Error(`Seller invitation conflicts with existing ${fields}`);
      }

      if (error.code === 'P2003') {
        return new Error('Seller invitation references an invalid record');
      }
    }

    return error instanceof Error
      ? error
      : new Error('Could not persist seller invitation');
  }

  private toDeletionTarget(seller: {
    id: string;
    usuario_id: string;
    nombre: string;
    usuarios: {
      id: string;
      username: string;
      auth_user_id: string | null;
    };
  }): SellerDeletionTarget {
    return {
      sellerId: seller.id,
      userId: seller.usuario_id,
      username: seller.usuarios.username,
      sellerName: seller.nombre,
      authUserId: seller.usuarios.auth_user_id,
    };
  }

  private async recordDeletionAudit(
    tx: Prisma.TransactionClient,
    event: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    const payloadObject =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    await tx.auditoria_eventos.create({
      data: {
        usuario_id:
          typeof payloadObject.adminUserId === 'string'
            ? payloadObject.adminUserId
            : null,
        evento: event,
        payload,
      },
    });
  }

  private buildInvitationListWhere(
    query: ListSellerInvitationsQuery,
  ): Prisma.codigos_acceso_vendedorWhereInput {
    return {
      AND: [
        this.buildStatusWhere(query.status),
        query.email
          ? {
              email: {
                contains: query.email,
                mode: 'insensitive',
              },
            }
          : {},
        query.username
          ? {
              usuarios: {
                username: {
                  contains: query.username,
                  mode: 'insensitive',
                },
              },
            }
          : {},
        query.sellerName
          ? {
              vendedores: {
                nombre: {
                  contains: query.sellerName,
                  mode: 'insensitive',
                },
              },
            }
          : {},
      ],
    };
  }

  private buildSellerListWhere(
    query: ListSellersQuery,
  ): Prisma.vendedoresWhereInput {
    const activeFilter =
      query.active === undefined
        ? {}
        : query.active
          ? { activo: true, usuarios: { activo: true } }
          : { OR: [{ activo: false }, { usuarios: { activo: false } }] };

    return {
      AND: [
        activeFilter,
        query.roleId ? { usuarios: { rol_id: query.roleId } } : {},
        query.username
          ? {
              usuarios: {
                username: { contains: query.username, mode: 'insensitive' },
              },
            }
          : {},
        query.documentId
          ? { cedula: { contains: query.documentId, mode: 'insensitive' } }
          : {},
        query.createdFrom ? { creado_en: { gte: query.createdFrom } } : {},
        query.createdTo ? { creado_en: { lte: query.createdTo } } : {},
        query.search
          ? {
              OR: [
                { nombre: { contains: query.search, mode: 'insensitive' } },
                { cedula: { contains: query.search, mode: 'insensitive' } },
                { telefono: { contains: query.search, mode: 'insensitive' } },
                {
                  usuarios: {
                    username: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  usuarios: {
                    nombre: { contains: query.search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {},
      ],
    };
  }

  private buildSellerListOrderBy(
    query: ListSellersQuery,
  ): Prisma.vendedoresOrderByWithRelationInput {
    const direction = query.sortDirection;
    if (query.sortBy === 'name' || query.sortBy === 'nombre') {
      return { nombre: direction };
    }
    if (query.sortBy === 'documentId' || query.sortBy === 'cedula') {
      return { cedula: direction };
    }
    if (query.sortBy === 'username') {
      return { usuarios: { username: direction } };
    }
    if (query.sortBy === 'active' || query.sortBy === 'activo') {
      return { activo: direction };
    }
    return { creado_en: direction };
  }

  private buildStatusWhere(
    status?: SellerAccessCodeStatus,
  ): Prisma.codigos_acceso_vendedorWhereInput {
    if (!status) {
      return {};
    }

    if (status === 'PENDIENTE') {
      return {
        estado: codigo_acceso_estado.PENDIENTE,
        expira_en: {
          gte: new Date(),
        },
      };
    }

    if (status === 'EXPIRADO') {
      return {
        OR: [
          { estado: codigo_acceso_estado.EXPIRADO },
          {
            estado: codigo_acceso_estado.PENDIENTE,
            expira_en: {
              lt: new Date(),
            },
          },
        ],
      };
    }

    return {
      estado: status,
    };
  }

  private buildInvitationListOrderBy(
    query: ListSellerInvitationsQuery,
  ): Prisma.codigos_acceso_vendedorOrderByWithRelationInput {
    const direction = query.sortDirection;

    if (query.sortBy === 'email') {
      return { email: direction };
    }

    if (query.sortBy === 'status' || query.sortBy === 'estado') {
      return { estado: direction };
    }

    if (query.sortBy === 'expiresAt' || query.sortBy === 'expira_en') {
      return { expira_en: direction };
    }

    return { creado_en: direction };
  }

  private toEffectiveStatus(
    status: codigo_acceso_estado,
    expiresAt: Date,
  ): SellerAccessCodeStatus {
    if (status === codigo_acceso_estado.PENDIENTE && expiresAt < new Date()) {
      return 'EXPIRADO';
    }

    return status;
  }

  async resendAccessCode(
    input: PersistResendSellerAccessCodeInput,
  ): Promise<SellerInvitation | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const latestAccessCode = await tx.codigos_acceso_vendedor.findFirst({
          where: {
            email: input.email,
          },
          include: {
            usuarios: true,
            vendedores: true,
          },
          orderBy: {
            creado_en: 'desc',
          },
        });

        if (!latestAccessCode) {
          return null;
        }

        if (
          latestAccessCode.usuarios.activo ||
          latestAccessCode.vendedores.activo
        ) {
          throw new Error('Seller account is already active');
        }

        await tx.codigos_acceso_vendedor.updateMany({
          where: {
            OR: [
              { email: input.email },
              { usuario_id: latestAccessCode.usuario_id },
              { vendedor_id: latestAccessCode.vendedor_id },
            ],
            estado: codigo_acceso_estado.PENDIENTE,
          },
          data: {
            estado: codigo_acceso_estado.REVOCADO,
          },
        });

        await tx.codigos_acceso_vendedor.create({
          data: {
            usuario_id: latestAccessCode.usuario_id,
            vendedor_id: latestAccessCode.vendedor_id,
            email: input.email,
            codigo_hash: input.accessCodeHash,
            enlace_token_hash: input.actionTokenHash,
            expira_en: input.expiresAt,
            creado_por: input.adminUserId,
          },
        });

        return {
          userId: latestAccessCode.usuario_id,
          sellerId: latestAccessCode.vendedor_id,
          email: input.email,
          sellerName: latestAccessCode.vendedores.nombre,
          expiresAt: input.expiresAt,
        };
      });
    } catch (error) {
      throw this.toInvitationError(error);
    }
  }

  async revokeInvitation(
    input: RevokeSellerInvitationInput,
  ): Promise<RevokedSellerInvitation | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.codigos_acceso_vendedor.updateMany({
          where: {
            id: input.invitationId,
            estado: codigo_acceso_estado.PENDIENTE,
            expira_en: {
              gt: new Date(),
            },
          },
          data: {
            estado: codigo_acceso_estado.REVOCADO,
          },
        });

        if (result.count === 0) {
          return null;
        }

        const invitation = await tx.codigos_acceso_vendedor.findUnique({
          where: {
            id: input.invitationId,
          },
          include: {
            vendedores: {
              select: {
                nombre: true,
              },
            },
          },
        });

        if (!invitation) {
          return null;
        }

        return {
          id: invitation.id,
          userId: invitation.usuario_id,
          sellerId: invitation.vendedor_id,
          email: invitation.email,
          sellerName: invitation.vendedores.nombre,
          status: 'REVOCADO',
        };
      });
    } catch (error) {
      throw this.toInvitationError(error);
    }
  }

  async findPendingAccessCode(
    email?: string,
    accessCodeHash?: string,
    actionTokenHash?: string,
  ): Promise<PendingSellerAccess | null> {
    const credentialWhere = this.buildAccessCredentialWhere(
      email,
      accessCodeHash,
      actionTokenHash,
    );

    if (!credentialWhere) {
      return null;
    }

    return this.withInvitationContext(
      email,
      accessCodeHash,
      actionTokenHash,
      () => this.findPendingAccessCodeInContext(credentialWhere),
    );
  }

  private async findPendingAccessCodeInContext(
    credentialWhere: Prisma.codigos_acceso_vendedorWhereInput,
  ): Promise<PendingSellerAccess | null> {
    const accessCode = await this.prisma.codigos_acceso_vendedor.findFirst({
      where: {
        ...credentialWhere,
        estado: codigo_acceso_estado.PENDIENTE,
        expira_en: {
          gt: new Date(),
        },
      },
      include: {
        vendedores: true,
      },
      orderBy: {
        creado_en: 'desc',
      },
    });

    if (!accessCode) {
      return null;
    }

    return {
      userId: accessCode.usuario_id,
      sellerId: accessCode.vendedor_id,
      email: accessCode.email,
      sellerName: accessCode.vendedores.nombre,
    };
  }

  async confirmAccessCode(
    input: ConfirmSellerAccessInput,
  ): Promise<ConfirmedSellerAccess | null> {
    const credentialWhere = this.buildAccessCredentialWhere(
      input.email,
      input.accessCodeHash,
      input.actionTokenHash,
    );

    if (!credentialWhere) {
      return null;
    }

    return this.withInvitationContext(
      input.email,
      input.accessCodeHash,
      input.actionTokenHash,
      () => this.confirmAccessCodeInContext(input, credentialWhere),
    );
  }

  private async confirmAccessCodeInContext(
    input: ConfirmSellerAccessInput,
    credentialWhere: Prisma.codigos_acceso_vendedorWhereInput,
  ): Promise<ConfirmedSellerAccess | null> {
    const accessCode = await this.prisma.codigos_acceso_vendedor.findFirst({
      where: {
        ...credentialWhere,
        estado: codigo_acceso_estado.PENDIENTE,
        expira_en: {
          gt: new Date(),
        },
      },
      include: {
        usuarios: true,
        vendedores: true,
      },
      orderBy: {
        creado_en: 'desc',
      },
    });

    if (!accessCode) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.codigos_acceso_vendedor.updateMany({
        where: {
          id: accessCode.id,
          estado: codigo_acceso_estado.PENDIENTE,
          expira_en: { gt: new Date() },
        },
        data: {
          estado: codigo_acceso_estado.USADO,
          usado_en: new Date(),
        },
      });

      if (consumed.count !== 1) {
        return null;
      }

      const user = await tx.usuarios.update({
        where: { id: accessCode.usuario_id },
        data: {
          auth_user_id: input.authUserId,
          activo: true,
        },
      });
      const seller = await tx.vendedores.update({
        where: { id: accessCode.vendedor_id },
        data: {
          activo: true,
        },
      });
      await tx.membresias_tenant.update({
        where: { id: seller.membresia_id },
        data: {
          estado: 'ACTIVO',
          eliminado_en: null,
        },
      });

      return {
        userId: user.id,
        sellerId: seller.id,
        email: accessCode.email,
      };
    });
  }

  private async withInvitationContext<T>(
    email: string | undefined,
    accessCodeHash: string | undefined,
    actionTokenHash: string | undefined,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const activateAndRun = async (): Promise<T | null> => {
      const rows = await this.prisma.$queryRaw<Array<{ active: boolean }>>(
        Prisma.sql`SELECT app_private.set_seller_invitation_context(
          ${email ?? null}::text,
          ${accessCodeHash ?? null}::text,
          ${actionTokenHash ?? null}::text
        ) AS active`,
      );
      if (!rows[0]?.active) return null;
      return work();
    };

    return this.prisma.hasRequestTransaction()
      ? activateAndRun()
      : this.prisma.runInRequestTransaction(activateAndRun);
  }

  private buildAccessCredentialWhere(
    email?: string,
    accessCodeHash?: string,
    actionTokenHash?: string,
  ): Prisma.codigos_acceso_vendedorWhereInput | null {
    if (actionTokenHash) {
      return { enlace_token_hash: actionTokenHash };
    }

    if (email && accessCodeHash) {
      return { email, codigo_hash: accessCodeHash };
    }

    return null;
  }
}
