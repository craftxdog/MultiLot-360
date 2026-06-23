import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SystemParameter } from '../../domain/entities';
import {
  ListSystemParametersQuery,
  SYSTEM_PARAMETERS_REPOSITORY,
  SystemParametersRepository,
} from '../../domain/ports';

@Injectable()
export class ListSystemParametersUseCase extends UseCase<
  ListSystemParametersQuery,
  PaginatedResult<SystemParameter>,
  AppError
> {
  constructor(
    @Inject(SYSTEM_PARAMETERS_REPOSITORY)
    private readonly systemParametersRepository: SystemParametersRepository,
  ) {
    super();
  }

  async execute(
    input: ListSystemParametersQuery,
  ): Promise<Result<PaginatedResult<SystemParameter>, AppError>> {
    try {
      return Result.success(await this.systemParametersRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list system parameters',
        error,
      );
    }
  }
}
