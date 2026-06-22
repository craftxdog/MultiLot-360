import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { DrawResult } from '../../domain/entities';
import {
  CreateResultInput,
  RESULTS_REPOSITORY,
  ResultsRepository,
} from '../../domain/ports';

export type CreateResultCommand = CreateResultInput;

@Injectable()
export class CreateResultUseCase extends UseCase<
  CreateResultCommand,
  DrawResult,
  AppError
> {
  constructor(
    @Inject(RESULTS_REPOSITORY)
    private readonly resultsRepository: ResultsRepository,
  ) {
    super();
  }

  async execute(
    input: CreateResultCommand,
  ): Promise<Result<DrawResult, AppError>> {
    try {
      return Result.success(
        await this.resultsRepository.create({
          ...input,
          winningNumber: this.normalizeNumber(input.winningNumber),
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create result',
        error,
        this.toHttpStatus(error),
      );
    }
  }

  private normalizeNumber(number: string): string {
    return number.replace(/\D/g, '').padStart(2, '0');
  }

  private toHttpStatus(error: unknown): number | undefined {
    if (!(error instanceof Error)) return undefined;
    const message = error.message.toLowerCase();

    if (message.includes('not found')) return 404;
    if (message.includes('already')) return 409;
    if (
      message.includes('closed') ||
      message.includes('must be') ||
      message.includes('invalid')
    ) {
      return 422;
    }

    return undefined;
  }
}
