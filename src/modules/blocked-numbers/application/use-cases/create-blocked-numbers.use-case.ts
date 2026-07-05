import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  INTEGRATION_EVENT_PUBLISHER,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  Result,
  UseCase,
  operationalAudience,
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
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
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

      const blocks = await this.blockedNumbersRepository.createMany({
        ...input,
        numbers,
      });
      const firstBlock = blocks[0];

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.blockedNumbersCreated,
        aggregateId: firstBlock?.id,
        audience: operationalAudience.blockedNumbers(),
        payload: {
          blockIds: blocks.map((block) => block.id),
          numbers: blocks.map((block) => block.number),
          shiftId: firstBlock?.shift?.id ?? null,
          date: firstBlock?.date ?? firstBlock?.shift?.date ?? null,
        },
      });

      return Result.success(blocks);
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
