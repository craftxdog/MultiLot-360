import {
  ConfirmedSellerAccess,
  CreateSellerInvitationCommand,
  ResendSellerAccessCodeCommand,
  SellerInvitation,
} from '../entities';

export const SELLER_ONBOARDING_REPOSITORY = Symbol(
  'SELLER_ONBOARDING_REPOSITORY',
);

export type PersistSellerInvitationInput = CreateSellerInvitationCommand & {
  accessCodeHash: string;
  expiresAt: Date;
};

export type ConfirmSellerAccessInput = {
  email: string;
  accessCodeHash: string;
  authUserId: string;
};

export type PersistResendSellerAccessCodeInput =
  ResendSellerAccessCodeCommand & {
    accessCodeHash: string;
    expiresAt: Date;
  };

export type PendingSellerAccess = {
  userId: string;
  sellerId: string;
  email: string;
  sellerName: string;
};

export interface SellerOnboardingRepository {
  createInvitation(
    input: PersistSellerInvitationInput,
  ): Promise<SellerInvitation>;
  resendAccessCode(
    input: PersistResendSellerAccessCodeInput,
  ): Promise<SellerInvitation | null>;
  findPendingAccessCode(
    email: string,
    accessCodeHash: string,
  ): Promise<PendingSellerAccess | null>;
  confirmAccessCode(
    input: ConfirmSellerAccessInput,
  ): Promise<ConfirmedSellerAccess | null>;
}
