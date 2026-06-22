import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawConfiguration } from '../../domain/entities';
import {
  DRAWS_REPOSITORY,
  DrawsRepository,
  ListDrawConfigurationsQuery,
} from '../../domain/ports';

@Injectable()
export class ListDrawConfigurationsUseCase extends UseCase<
  ListDrawConfigurationsQuery,
  PaginatedResult<DrawConfiguration>,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(
    input: ListDrawConfigurationsQuery,
  ): Promise<Result<PaginatedResult<DrawConfiguration>, AppError>> {
    try {
      return Result.success(
        await this.drawsRepository.listConfigurations(input),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list draw configurations',
        error,
      );
    }
  }
}
