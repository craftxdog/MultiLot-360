import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SellerDeletionResult } from '../../domain/entities';
import {
  AUTH_PROVIDER,
  AuthProviderPort,
  DeleteSellerInput,
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';

export type DeleteSellerCommand = DeleteSellerInput & {
  hardDelete?: boolean;
};

@Injectable()
export class DeleteSellerUseCase extends UseCase<
  DeleteSellerCommand,
  SellerDeletionResult,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly repository: SellerOnboardingRepository,
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
  ) {
    super();
  }

  async execute(
    input: DeleteSellerCommand,
  ): Promise<Result<SellerDeletionResult, AppError>> {
    try {
      const reason = input.reason?.trim() || undefined;
      const target = await this.repository.findDeletionTarget(input.sellerId);

      if (!target) {
        return ErrorFactory.useCase('El vendedor no existe.', undefined, 404);
      }

      if (target.userId === input.adminUserId) {
        return ErrorFactory.useCase(
          'No puedes eliminar tu propio usuario desde este endpoint.',
          undefined,
          400,
        );
      }

      if (!input.hardDelete) {
        const result = await this.repository.softDeleteSeller({
          sellerId: input.sellerId,
          adminUserId: input.adminUserId,
          reason,
        });

        if (!result) {
          return ErrorFactory.useCase('El vendedor no existe.', undefined, 404);
        }

        return Result.success(result);
      }

      let authUserDeleted = false;
      if (target.authUserId) {
        await this.authProvider.deleteUser(target.authUserId);
        authUserDeleted = true;
      }

      const result = await this.repository.hardDeleteSeller({
        sellerId: input.sellerId,
        adminUserId: input.adminUserId,
        reason,
        authUserDeleted,
      });

      if (!result) {
        return ErrorFactory.useCase('El vendedor no existe.', undefined, 404);
      }

      return Result.success(result);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'No fue posible eliminar el vendedor.',
        error,
      );
    }
  }
}
