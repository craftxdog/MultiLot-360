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
  CreateBlockedNumbersInput,
} from '../../domain/ports';

export type CreateBlockedNumbersCommand = CreateBlockedNumbersInput;

@Injectable()
export class CreateBlockedNumbersUseCase extends UseCase<
  CreateBlockedNumbersCommand,
  BlockedNumber[],
  AppError
> {
  constructor(
    @Inject(BLOCKED_NUMBERS_REPOSITORY)
    private readonly blockedNumbersRepository: BlockedNumbersRepository,
  ) {
    super();
  }

  async execute(
    input: CreateBlockedNumbersCommand,
  ): Promise<Result<BlockedNumber[], AppError>> {
    try {
      const scopeError = this.validateScope(input);

      if (scopeError) {
        return ErrorFactory.useCase(scopeError, undefined, 400);
      }

      const numbers = this.normalizeUniqueNumbers(input.numbers);

      if (numbers.length === 0) {
        return ErrorFactory.useCase(
          'At least one number is required',
          undefined,
          400,
        );
      }

      return Result.success(
        await this.blockedNumbersRepository.createMany({
          ...input,
          numbers,
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not create blocked numbers',
        error,
        this.toHttpStatus(error),
      );
    }
  }

  private validateScope(
    input: Pick<CreateBlockedNumbersCommand, 'date' | 'shiftId'>,
  ): string | null {
    const scopeCount =
      Number(Boolean(input.date)) + Number(Boolean(input.shiftId));

    return scopeCount === 1
      ? null
      : 'Use date or shiftId as scope, but not both';
  }

  private normalizeUniqueNumbers(numbers: string[]): string[] {
    return [
      ...new Set(
        numbers.map((number) => number.replace(/\D/g, '').padStart(2, '0')),
      ),
    ];
  }

  private toHttpStatus(error: unknown): number | undefined {
    if (!(error instanceof Error)) return undefined;
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('does not exist')) {
      return 404;
    }

    if (message.includes('already blocked') || message.includes('duplicate')) {
      return 409;
    }

    return undefined;
  }
}
