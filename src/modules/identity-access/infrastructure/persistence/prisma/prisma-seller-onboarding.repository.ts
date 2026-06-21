import { Injectable } from '@nestjs/common';
import { codigo_acceso_estado } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import {
  ConfirmSellerAccessInput,
  PendingSellerAccess,
  PersistSellerInvitationInput,
  SellerOnboardingRepository,
} from '../../../domain/ports';
import { ConfirmedSellerAccess, SellerInvitation } from '../../../domain';

const DEFAULT_SELLER_ROLE_NAME = 'vendedor';
const PENDING_PASSWORD_HASH = 'supabase:pending';

@Injectable()
export class PrismaSellerOnboardingRepository implements SellerOnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(
    input: PersistSellerInvitationInput,
  ): Promise<SellerInvitation> {
    const role = await this.prisma.roles.findUnique({
      where: {
        nombre: input.roleName ?? DEFAULT_SELLER_ROLE_NAME,
      },
    });

    if (!role) {
      throw new Error(
        `Role "${input.roleName ?? DEFAULT_SELLER_ROLE_NAME}" does not exist`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.usuarios.findUnique({
        where: {
          username: input.username,
        },
        include: {
          vendedores: true,
        },
      });

      if (existingUser?.activo) {
        throw new Error(`User "${input.email}" is already active`);
      }

      if (existingUser && !existingUser.vendedores) {
        throw new Error(`User "${input.email}" is not a seller`);
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
