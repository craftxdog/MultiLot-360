import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawConfiguration } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type GetDrawConfigurationQuery = {
  configurationId: string;
};

@Injectable()
export class GetDrawConfigurationUseCase extends UseCase<
  GetDrawConfigurationQuery,
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
    input: GetDrawConfigurationQuery,
  ): Promise<Result<DrawConfiguration, AppError>> {
    try {
      const configuration = await this.drawsRepository.findConfigurationById(
        input.configurationId,
      );

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
          : 'Could not get draw configuration',
        error,
      );
    }
  }
}
