import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { BlockedNumber } from '../../domain/entities';
import {
  BLOCKED_NUMBERS_REPOSITORY,
  BlockedNumbersRepository,
  ListBlockedNumbersQuery,
} from '../../domain/ports';

@Injectable()
export class ListBlockedNumbersUseCase extends UseCase<
  ListBlockedNumbersQuery,
  PaginatedResult<BlockedNumber>,
  AppError
> {
  constructor(
    @Inject(BLOCKED_NUMBERS_REPOSITORY)
    private readonly blockedNumbersRepository: BlockedNumbersRepository,
  ) {
    super();
  }

  async execute(
    input: ListBlockedNumbersQuery,
  ): Promise<Result<PaginatedResult<BlockedNumber>, AppError>> {
    try {
      return Result.success(await this.blockedNumbersRepository.list(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not list blocked numbers',
        error,
      );
    }
  }
}
