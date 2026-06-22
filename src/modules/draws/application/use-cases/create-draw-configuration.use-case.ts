import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawConfiguration } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type CreateDrawConfigurationCommand = {
  code: string;
  time: string;
  tuesdayOnly?: boolean;
  lockSecondsBefore?: number;
  reopenSecondsAfter?: number;
  active?: boolean;
};

@Injectable()
export class CreateDrawConfigurationUseCase extends UseCase<
  CreateDrawConfigurationCommand,
  DrawConfiguration,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(
    input: CreateDrawConfigurationCommand,
  ): Promise<Result<DrawConfiguration, AppError>> {
    try {
      return Result.success(
        await this.drawsRepository.createConfiguration({
          ...input,
          code: input.code.trim().toLowerCase(),
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not create draw configuration',
        error,
      );
    }
  }
}
