import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawShift } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type ReopenDrawShiftCommand = {
  shiftId: string;
};

@Injectable()
export class ReopenDrawShiftUseCase extends UseCase<
  ReopenDrawShiftCommand,
  DrawShift,
  AppError
> {
  constructor(
    @Inject(DRAWS_REPOSITORY)
    private readonly drawsRepository: DrawsRepository,
  ) {
    super();
  }

  async execute(
    input: ReopenDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      const shift = await this.drawsRepository.reopenShift(input.shiftId);

      if (!shift) {
        return ErrorFactory.useCase(
          'Draw shift does not exist',
          undefined,
          404,
        );
      }

      return Result.success(shift);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not reopen draw shift',
        error,
      );
    }
  }
}
