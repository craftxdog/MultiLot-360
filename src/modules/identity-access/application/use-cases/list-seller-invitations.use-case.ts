import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../../common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  ListSellerInvitationsQuery,
  SellerInvitationListItem,
} from '../../domain/entities';
import {
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';

@Injectable()
export class ListSellerInvitationsUseCase extends UseCase<
  ListSellerInvitationsQuery,
  PaginatedResult<SellerInvitationListItem>,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly sellerOnboardingRepository: SellerOnboardingRepository,
  ) {
    super();
  }

  async execute(
    input: ListSellerInvitationsQuery,
  ): Promise<Result<PaginatedResult<SellerInvitationListItem>, AppError>> {
    try {
      return Result.success(
        await this.sellerOnboardingRepository.listInvitations(input),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list seller invitations',
        error,
      );
    }
  }
}
