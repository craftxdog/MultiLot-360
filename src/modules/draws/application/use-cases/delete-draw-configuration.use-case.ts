import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  AUTH_PROVIDER,
  AuthProviderPort,
} from '../../../identity-access/domain';
import { DeleteDrawConfigurationResult } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type SoftDeleteDrawConfigurationCommand = {
  configurationId: string;
  reason?: string;
};

export type HardDeleteDrawConfigurationCommand =
  SoftDeleteDrawConfigurationCommand & {
    adminPassword: string;
    actorEmail?: string | null;
    actorAuthUserId?: string | null;
    confirmation: 'DELETE_DRAW_CONFIGURATION';
  };

@Injectable()
export class SoftDeleteDrawConfigurationUseCase extends UseCase<
  SoftDeleteDrawConfigurationCommand,
  DeleteDrawConfigurationResult,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(
    input: SoftDeleteDrawConfigurationCommand,
  ): Promise<Result<DeleteDrawConfigurationResult, AppError>> {
    try {
      const deleted = await this.drawsRepository.softDeleteConfiguration(input);

      return deleted
        ? Result.success(deleted)
        : ErrorFactory.useCase(
            'Draw configuration does not exist',
            undefined,
            404,
          );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not soft-delete draw configuration',
        error,
      );
    }
  }
}

@Injectable()
export class HardDeleteDrawConfigurationUseCase extends UseCase<
  HardDeleteDrawConfigurationCommand,
  DeleteDrawConfigurationResult,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
  ) {
    super();
  }

  async execute(
    input: HardDeleteDrawConfigurationCommand,
  ): Promise<Result<DeleteDrawConfigurationResult, AppError>> {
    try {
      if (input.confirmation !== 'DELETE_DRAW_CONFIGURATION') {
        return ErrorFactory.useCase(
          'Hard delete confirmation phrase is required',
          undefined,
          400,
        );
      }

      if (!input.actorEmail || !input.actorAuthUserId) {
        return ErrorFactory.useCase(
          'Admin reauthentication requires an authenticated email',
          undefined,
          403,
        );
      }

      const session = await this.authProvider.signInWithPassword({
        email: input.actorEmail,
        password: input.adminPassword,
      });

      if (session.authUserId !== input.actorAuthUserId) {
        return ErrorFactory.useCase(
          'Admin reauthentication did not match the current session',
          undefined,
          403,
        );
      }

      const deleted = await this.drawsRepository.hardDeleteConfiguration({
        configurationId: input.configurationId,
        reason: input.reason,
      });

      return deleted
        ? Result.success(deleted)
        : ErrorFactory.useCase(
            'Draw configuration does not exist',
            undefined,
            404,
          );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not hard-delete draw configuration',
        error,
        error instanceof Error &&
          error.message.toLowerCase().includes('invalid')
          ? 403
          : undefined,
      );
    }
  }
}
