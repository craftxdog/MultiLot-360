import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { RevokedSellerInvitation } from '../../domain/entities';
import {
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';

export type RevokeSellerInvitationCommand = {
  invitationId: string;
  adminUserId?: string;
};

@Injectable()
export class RevokeSellerInvitationUseCase extends UseCase<
  RevokeSellerInvitationCommand,
  RevokedSellerInvitation,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly sellerOnboardingRepository: SellerOnboardingRepository,
  ) {
    super();
  }

  async execute(
    input: RevokeSellerInvitationCommand,
  ): Promise<Result<RevokedSellerInvitation, AppError>> {
    try {
      const invitation =
        await this.sellerOnboardingRepository.revokeInvitation(input);

      if (!invitation) {
        return ErrorFactory.useCase(
          'Seller invitation is not pending or does not exist',
          undefined,
          404,
        );
      }

      return Result.success(invitation);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not revoke seller invitation',
        error,
      );
    }
  }
}
