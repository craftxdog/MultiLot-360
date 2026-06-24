import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { BlockedNumber } from '../../domain/entities';
import {
  BLOCKED_NUMBERS_REPOSITORY,
  BlockedNumbersRepository,
} from '../../domain/ports';

export type GetBlockedNumberQuery = {
  blockId: string;
};

@Injectable()
export class GetBlockedNumberUseCase extends UseCase<
  GetBlockedNumberQuery,
  BlockedNumber,
  AppError
> {
  constructor(
    @Inject(BLOCKED_NUMBERS_REPOSITORY)
    private readonly blockedNumbersRepository: BlockedNumbersRepository,
  ) {
    super();
  }

  async execute(
    input: GetBlockedNumberQuery,
  ): Promise<Result<BlockedNumber, AppError>> {
    try {
      const block = await this.blockedNumbersRepository.findById(input.blockId);

      if (!block) {
        return ErrorFactory.useCase('Blocked number not found', undefined, 404);
      }

      return Result.success(block);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not get blocked number',
        error,
      );
    }
  }
}
