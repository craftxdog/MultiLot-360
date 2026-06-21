import { Inject, Injectable } from '@nestjs/common';
import { MAILER_PORT, MailerPort } from '../../../../infrastructure/mailer';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  ResendSellerAccessCodeCommand,
  SellerInvitation,
} from '../../domain/entities';
import {
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';
import { SellerAccessCodeService } from '../services';

@Injectable()
export class ResendSellerAccessCodeUseCase extends UseCase<
  ResendSellerAccessCodeCommand,
  SellerInvitation,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly sellerOnboardingRepository: SellerOnboardingRepository,
    @Inject(MAILER_PORT)
    private readonly mailer: MailerPort,
    private readonly accessCodeService: SellerAccessCodeService,
  ) {
    super();
  }

  async execute(
    input: ResendSellerAccessCodeCommand,
  ): Promise<Result<SellerInvitation, AppError>> {
    try {
      const email = input.email.trim().toLowerCase();
      const accessCode = this.accessCodeService.generate();
      const invitation = await this.sellerOnboardingRepository.resendAccessCode(
        {
          ...input,
          email,
          accessCodeHash: this.accessCodeService.hash(accessCode),
          expiresAt: this.accessCodeService.expiresAt(),
        },
      );

      if (!invitation) {
        return ErrorFactory.useCase(
          `Seller invitation for "${email}" does not exist`,
          undefined,
          404,
        );
      }

      await this.mailer.sendSellerAccessCode({
        recipient: {
          email: invitation.email,
          name: invitation.sellerName,
        },
        sellerName: invitation.sellerName,
        accessCode,
        expiresInMinutes:
          Math.ceil((invitation.expiresAt.getTime() - Date.now()) / 60000) || 1,
      });

      return Result.success(invitation);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not resend seller access code',
        error,
      );
    }
  }
}
