import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawShift } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type CloseDrawShiftCommand = {
  shiftId: string;
};

@Injectable()
export class CloseDrawShiftUseCase extends UseCase<
  CloseDrawShiftCommand,
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
    input: CloseDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      const shift = await this.drawsRepository.closeShift(input.shiftId);

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
        error instanceof Error ? error.message : 'Could not close draw shift',
        error,
      );
    }
  }
}
