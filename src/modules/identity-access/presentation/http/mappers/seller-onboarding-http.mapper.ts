import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  CreateSellerInvitationCommand,
  ResendSellerAccessCodeCommand,
  RevokeSellerInvitationCommand,
} from '../../../application';
import { ListSellerInvitationsQuery, ListSellersQuery } from '../../../domain';
import {
  CreateSellerInvitationDto,
  ListSellerInvitationsQueryDto,
  ListSellersQueryDto,
  ResendSellerAccessCodeDto,
} from '../dto';

export class SellerOnboardingHttpMapper {
  static toListSellersQuery(dto: ListSellersQueryDto): ListSellersQuery {
    return {
      search: dto.search,
      username: dto.username,
      documentId: dto.documentId,
      active: dto.active,
      roleId: dto.roleId,
      createdFrom: dto.createdFrom,
      createdTo: dto.createdTo,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toCreateInvitationCommand(
    dto: CreateSellerInvitationDto,
    admin: AuthenticatedUserContext,
  ): CreateSellerInvitationCommand {
    return {
      email: dto.email,
      username: dto.username,
      sellerName: dto.sellerName,
      documentId: dto.documentId,
      phone: dto.phone,
      address: dto.address,
      roleName: dto.roleName,
      adminUserId: admin.id,
      adminName: admin.username ?? admin.roleName ?? 'Administrador',
    };
  }

  static toListInvitationsQuery(
    dto: ListSellerInvitationsQueryDto,
  ): ListSellerInvitationsQuery {
    return {
      email: dto.email,
      username: dto.username,
      sellerName: dto.sellerName,
      status: dto.status,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
    };
  }

  static toResendAccessCodeCommand(
    dto: ResendSellerAccessCodeDto,
    admin: AuthenticatedUserContext,
  ): ResendSellerAccessCodeCommand {
    return {
      email: dto.email,
      adminUserId: admin.id,
    };
  }

  static toRevokeInvitationCommand(
    invitationId: string,
    admin: AuthenticatedUserContext,
  ): RevokeSellerInvitationCommand {
    return {
      invitationId,
      adminUserId: admin.id,
    };
  }
}
