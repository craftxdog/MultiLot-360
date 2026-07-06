import {
  ConfirmedSellerAccess,
  RevokedSellerInvitation,
  SellerAccessCodeStatus,
  SellerInvitationListItem,
  SellerInvitation,
  SellerDirectoryItem,
} from '../entities';
import { PaginatedResult } from '../../../../shared-kernel';

export const SELLER_ONBOARDING_REPOSITORY = Symbol(
  'SELLER_ONBOARDING_REPOSITORY',
);

export type ListSellerInvitationsQuery = {
  email?: string;
  username?: string;
  sellerName?: string;
  status?: SellerAccessCodeStatus;
  page: number;
  limit: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

export type ListSellersQuery = {
  search?: string;
  username?: string;
  documentId?: string;
  active?: boolean;
  roleId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

export type PersistSellerInvitationInput = {
  email: string;
  username: string;
  sellerName: string;
  documentId: string;
  phone?: string;
  address?: string;
  roleName?: string;
  adminUserId?: string;
  accessCodeHash: string;
  expiresAt: Date;
};

export type ConfirmSellerAccessInput = {
  email: string;
  accessCodeHash: string;
  authUserId: string;
};

export type PersistResendSellerAccessCodeInput = {
  email: string;
  adminUserId?: string;
  accessCodeHash: string;
  expiresAt: Date;
};

export type RevokeSellerInvitationInput = {
  invitationId: string;
  adminUserId?: string;
};

export type PendingSellerAccess = {
  userId: string;
  sellerId: string;
  email: string;
  sellerName: string;
};

export interface SellerOnboardingRepository {
  listSellers(
    query: ListSellersQuery,
  ): Promise<PaginatedResult<SellerDirectoryItem>>;
  listInvitations(
    query: ListSellerInvitationsQuery,
  ): Promise<PaginatedResult<SellerInvitationListItem>>;
  createInvitation(
    input: PersistSellerInvitationInput,
  ): Promise<SellerInvitation>;
  resendAccessCode(
    input: PersistResendSellerAccessCodeInput,
  ): Promise<SellerInvitation | null>;
  revokeInvitation(
    input: RevokeSellerInvitationInput,
  ): Promise<RevokedSellerInvitation | null>;
  findPendingAccessCode(
    email: string,
    accessCodeHash: string,
  ): Promise<PendingSellerAccess | null>;
  confirmAccessCode(
    input: ConfirmSellerAccessInput,
  ): Promise<ConfirmedSellerAccess | null>;
}
