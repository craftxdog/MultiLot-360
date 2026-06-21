import { Injectable } from '@nestjs/common';
import { Prisma, codigo_acceso_estado } from '@prisma/client';
import {
  buildOffsetPagination,
  getOffsetSkip,
  PaginatedResult,
} from '../../../../../common';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  ConfirmSellerAccessInput,
  PendingSellerAccess,
  PersistResendSellerAccessCodeInput,
  PersistSellerInvitationInput,
  SellerOnboardingRepository,
} from '../../../domain/ports';
import {
  ConfirmedSellerAccess,
  ListSellerInvitationsQuery,
  SellerAccessCodeStatus,
  SellerInvitation,
  SellerInvitationListItem,
} from '../../../domain';

const DEFAULT_SELLER_ROLE_NAME = 'vendedor';
const PENDING_PASSWORD_HASH = 'supabase:pending';

@Injectable()
export class PrismaSellerOnboardingRepository implements SellerOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

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
            vendedores: true,
          },
        });

        if (existingUser?.activo) {
          throw new Error(`User "${input.username}" is already active`);
        }

        if (existingUser && !existingUser.vendedores) {
          throw new Error(`User "${input.username}" is not a seller`);
        }

        const user = existingUser
          ? await tx.usuarios.update({
              where: {
                id: existingUser.id,
              },
              data: {
                rol_id: role.id,
                nombre: input.sellerName,
                activo: false,
              },
            })
          : await tx.usuarios.create({
              data: {
                username: input.username,
                pass_hash: PENDING_PASSWORD_HASH,
                rol_id: role.id,
                activo: false,
                nombre: input.sellerName,
              },
            });

        const seller = existingUser?.vendedores
          ? await tx.vendedores.update({
              where: {
                id: existingUser.vendedores.id,
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
                usuario_id: user.id,
                nombre: input.sellerName,
                cedula: input.documentId,
                telefono: input.phone,
                direccion: input.address,
                activo: false,
              },
            });

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
            usuario_id: user.id,
            vendedor_id: seller.id,
            email: input.email,
            codigo_hash: input.accessCodeHash,
            expira_en: input.expiresAt,
            creado_por: input.adminUserId,
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

  async findPendingAccessCode(
    email: string,
    accessCodeHash: string,
  ): Promise<PendingSellerAccess | null> {
    const accessCode = await this.prisma.codigos_acceso_vendedor.findFirst({
      where: {
        email,
        codigo_hash: accessCodeHash,
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
    const accessCode = await this.prisma.codigos_acceso_vendedor.findFirst({
      where: {
        email: input.email,
        codigo_hash: input.accessCodeHash,
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
      await tx.codigos_acceso_vendedor.update({
        where: { id: accessCode.id },
        data: {
          estado: codigo_acceso_estado.USADO,
          usado_en: new Date(),
        },
      });
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

      return {
        userId: user.id,
        sellerId: seller.id,
        email: input.email,
      };
    });
  }
}
