import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawConfigurationDeleteImpact } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

@Injectable()
export class GetDrawConfigurationDeleteImpactUseCase extends UseCase<
  { configurationId: string },
  DrawConfigurationDeleteImpact,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(input: {
    configurationId: string;
  }): Promise<Result<DrawConfigurationDeleteImpact, AppError>> {
    try {
      const impact = await this.drawsRepository.getConfigurationDeleteImpact(
        input.configurationId,
      );

      return impact
        ? Result.success(impact)
        : ErrorFactory.useCase(
            'Draw configuration does not exist',
            undefined,
            404,
          );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not calculate draw configuration delete impact',
        error,
      );
    }
  }
}
