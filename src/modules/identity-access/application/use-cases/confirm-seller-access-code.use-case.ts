import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  ConfirmedSellerAccess,
  ConfirmSellerAccessCodeCommand,
} from '../../domain/entities';
import {
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';
import { SellerAccessCodeService } from '../services';

@Injectable()
export class ConfirmSellerAccessCodeUseCase extends UseCase<
  ConfirmSellerAccessCodeCommand,
  ConfirmedSellerAccess,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly sellerOnboardingRepository: SellerOnboardingRepository,
    private readonly accessCodeService: SellerAccessCodeService,
  ) {
    super();
  }

  async execute(
    input: ConfirmSellerAccessCodeCommand,
  ): Promise<Result<ConfirmedSellerAccess, AppError>> {
    try {
      const confirmed = await this.sellerOnboardingRepository.confirmAccessCode(
        {
          email: input.email.trim().toLowerCase(),
          accessCodeHash: this.accessCodeService.hash(input.accessCode),
          authUserId: input.authUserId,
        },
      );

      if (!confirmed) {
        return ErrorFactory.useCase(
          'Invalid or expired seller access code',
          undefined,
          400,
        );
      }

      return Result.success(confirmed);
    } catch (error) {
      return ErrorFactory.useCase(
        'Could not confirm seller access code',
        error,
      );
    }
  }
}
