import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawShift } from '../../domain/entities';
import {
  DRAWS_REPOSITORY,
  DrawsRepository,
  ListDrawShiftsQuery,
} from '../../domain/ports';

@Injectable()
export class ListDrawShiftsUseCase extends UseCase<
  ListDrawShiftsQuery,
  PaginatedResult<DrawShift>,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(
    input: ListDrawShiftsQuery,
  ): Promise<Result<PaginatedResult<DrawShift>, AppError>> {
    try {
      return Result.success(await this.drawsRepository.listShifts(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not list draw shifts',
        error,
      );
    }
  }
}
