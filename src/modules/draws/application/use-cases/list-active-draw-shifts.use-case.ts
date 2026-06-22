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
  ListActiveDrawShiftsQuery,
} from '../../domain/ports';

@Injectable()
export class ListActiveDrawShiftsUseCase extends UseCase<
  ListActiveDrawShiftsQuery,
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
    input: ListActiveDrawShiftsQuery,
  ): Promise<Result<PaginatedResult<DrawShift>, AppError>> {
    try {
      return Result.success(await this.drawsRepository.listActiveShifts(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list active draw shifts',
        error,
      );
    }
  }
}
