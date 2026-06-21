import {
  ConfirmedSellerAccess,
  CreateSellerInvitationCommand,
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

export interface SellerOnboardingRepository {
  createInvitation(
    input: PersistSellerInvitationInput,
  ): Promise<SellerInvitation>;
  confirmAccessCode(
    input: ConfirmSellerAccessInput,
  ): Promise<ConfirmedSellerAccess | null>;
}
