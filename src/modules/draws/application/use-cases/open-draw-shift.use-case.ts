import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawShift } from '../../domain/entities';
import {
  DRAWS_REPOSITORY,
  DrawsRepository,
  OpenDrawShiftInput,
} from '../../domain/ports';

export type OpenDrawShiftCommand = OpenDrawShiftInput;

@Injectable()
export class OpenDrawShiftUseCase extends UseCase<
  OpenDrawShiftCommand,
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
    input: OpenDrawShiftCommand,
  ): Promise<Result<DrawShift, AppError>> {
    try {
      return Result.success(await this.drawsRepository.openShift(input));
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not open draw shift',
        error,
      );
    }
  }
}
