import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawShift } from '../../domain/entities';
import { DRAWS_REPOSITORY, DrawsRepository } from '../../domain/ports';

export type BlockDrawShiftCommand = {
  shiftId: string;
};

@Injectable()
export class BlockDrawShiftUseCase extends UseCase<
  BlockDrawShiftCommand,
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
    input: BlockDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      const shift = await this.drawsRepository.blockShift(input.shiftId);

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
        error instanceof Error ? error.message : 'Could not block draw shift',
        error,
      );
    }
  }
}
