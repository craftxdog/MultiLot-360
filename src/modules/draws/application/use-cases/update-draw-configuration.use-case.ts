import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawConfiguration } from '../../domain/entities';
import {
  DRAWS_REPOSITORY,
  DrawsRepository,
  UpdateDrawConfigurationInput,
} from '../../domain/ports';

export type UpdateDrawConfigurationCommand = UpdateDrawConfigurationInput;

@Injectable()
export class UpdateDrawConfigurationUseCase extends UseCase<
  UpdateDrawConfigurationCommand,
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
    input: UpdateDrawConfigurationCommand,
  ): Promise<Result<DrawConfiguration, AppError>> {
    try {
      const configuration = await this.drawsRepository.updateConfiguration({
        ...input,
        ...(input.code && { code: input.code.trim().toLowerCase() }),
      });

      if (!configuration) {
        return ErrorFactory.useCase(
          'Draw configuration does not exist',
          undefined,
          404,
        );
      }

      return Result.success(configuration);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not update draw configuration',
        error,
      );
    }
  }
}
