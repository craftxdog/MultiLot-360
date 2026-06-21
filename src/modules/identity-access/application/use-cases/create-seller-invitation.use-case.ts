import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SellerInvitation } from '../../domain/entities';
import {
  MAILER_PORT,
  MailerPort,
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';
import { SellerAccessCodeService } from '../services';

export type CreateSellerInvitationCommand = {
  email: string;
  username: string;
  sellerName: string;
  documentId: string;
  phone?: string;
  address?: string;
  roleName?: string;
  adminUserId?: string;
  adminName: string;
};

@Injectable()
export class CreateSellerInvitationUseCase extends UseCase<
  CreateSellerInvitationCommand,
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
    input: CreateSellerInvitationCommand,
  ): Promise<Result<SellerInvitation, AppError>> {
    try {
      const accessCode = this.accessCodeService.generate();
      const invitation = await this.sellerOnboardingRepository.createInvitation(
        {
          ...input,
          email: input.email.trim().toLowerCase(),
          username: input.username.trim().toLowerCase(),
          accessCodeHash: this.accessCodeService.hash(accessCode),
          expiresAt: this.accessCodeService.expiresAt(),
        },
      );

      await this.mailer.sendSellerInvitation({
        recipient: {
          email: invitation.email,
          name: invitation.sellerName,
        },
        adminName: input.adminName,
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
          : 'Could not create seller invitation',
        error,
      );
    }
  }
}
