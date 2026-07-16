import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { ConfirmedSellerAccess } from '../../domain/entities';
import {
  AUTH_PROVIDER,
  AuthProviderPort,
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';
import { SellerAccessCodeService } from '../services';

export type ConfirmSellerAccessCodeCommand = {
  email?: string;
  accessCode?: string;
  actionToken?: string;
  password: string;
};

@Injectable()
export class ConfirmSellerAccessCodeUseCase extends UseCase<
  ConfirmSellerAccessCodeCommand,
  ConfirmedSellerAccess,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly sellerOnboardingRepository: SellerOnboardingRepository,
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
    private readonly accessCodeService: SellerAccessCodeService,
  ) {
    super();
  }

  async execute(
    input: ConfirmSellerAccessCodeCommand,
  ): Promise<Result<ConfirmedSellerAccess, AppError>> {
    const email = input.email?.trim().toLowerCase();
    const accessCodeHash = input.accessCode
      ? this.accessCodeService.hash(input.accessCode)
      : undefined;
    const actionTokenHash = input.actionToken
      ? this.accessCodeService.hashActionToken(input.actionToken)
      : undefined;
    let authUserId: string | undefined;

    try {
      const pending =
        await this.sellerOnboardingRepository.findPendingAccessCode(
          email,
          accessCodeHash,
          actionTokenHash,
        );

      if (!pending) {
        return ErrorFactory.useCase(
          'Invalid or expired seller access code',
          undefined,
          422,
        );
      }

      const authUser = await this.authProvider.createUser({
        email: pending.email,
        password: input.password,
        name: pending.sellerName,
        emailConfirmed: true,
      });
      authUserId = authUser.id;

      const confirmed = await this.sellerOnboardingRepository.confirmAccessCode(
        {
          email,
          accessCodeHash,
          actionTokenHash,
          authUserId: authUser.id,
        },
      );

      if (!confirmed) {
        await this.safeDeleteAuthUser(authUser.id);

        return ErrorFactory.useCase(
          'Invalid or expired seller access code',
          undefined,
          422,
        );
      }

      return Result.success(confirmed);
    } catch (error) {
      if (authUserId) {
        await this.safeDeleteAuthUser(authUserId);
      }

      return ErrorFactory.useCase(
        'Could not confirm seller access code',
        error,
      );
    }
  }

  private async safeDeleteAuthUser(authUserId: string): Promise<void> {
    try {
      await this.authProvider.deleteUser(authUserId);
    } catch {
      // Best effort cleanup. The original confirmation error is returned.
    }
  }
}
