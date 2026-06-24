import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import {
  SALES_REPOSITORY,
  SaleItemInput,
  SalesRepository,
} from '../../domain/ports';

export type CreateSaleCommand = {
  requestedSellerId?: string;
  currentSellerId?: string;
  actorRoleName?: string;
  shiftId: string;
  items: SaleItemInput[];
};

@Injectable()
export class CreateSaleUseCase extends UseCase<
  CreateSaleCommand,
  Sale,
  AppError
> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async execute(input: CreateSaleCommand): Promise<Result<Sale, AppError>> {
    try {
      const sellerResult = this.resolveSellerId(input);

      if (sellerResult.isFailure) {
        return sellerResult;
      }

      const items = this.normalizeItems(input.items);

      if (items.length === 0) {
        return ErrorFactory.useCase(
          'At least one sale item is required',
          undefined,
          400,
        );
      }

      return Result.success(
        await this.salesRepository.create({
          sellerId: sellerResult.value,
          shiftId: input.shiftId,
          items,
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create sale',
        error,
        this.toHttpStatus(error),
      );
    }
  }

  private resolveSellerId(
    input: Pick<
      CreateSaleCommand,
      'actorRoleName' | 'currentSellerId' | 'requestedSellerId'
    >,
  ): Result<string, AppError> {
    const requestedSellerId = input.requestedSellerId;
    const currentSellerId = input.currentSellerId;

    if (
      requestedSellerId &&
      currentSellerId &&
      requestedSellerId !== currentSellerId &&
      !this.isAdmin(input.actorRoleName)
    ) {
      return ErrorFactory.useCase(
        'Sellers can only create sales for themselves',
        undefined,
        403,
      );
    }

    const sellerId = requestedSellerId ?? currentSellerId;

    if (!sellerId) {
      return ErrorFactory.useCase('sellerId is required', undefined, 400);
    }

    return Result.success(sellerId);
  }

  private normalizeItems(items: SaleItemInput[]): SaleItemInput[] {
    const totalsByNumber = new Map<string, number>();

    for (const item of items) {
      const number = item.number.replace(/\D/g, '').padStart(2, '0');
      totalsByNumber.set(
        number,
        (totalsByNumber.get(number) ?? 0) + item.prizeMiles,
      );
    }

    return [...totalsByNumber.entries()].map(([number, prizeMiles]) => ({
      number,
      prizeMiles,
    }));
  }

  private isAdmin(roleName?: string): boolean {
    return roleName?.toUpperCase() === 'ADMIN';
  }

  private toHttpStatus(error: unknown): number | undefined {
    if (!(error instanceof Error)) return undefined;
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('does not exist')) {
      return 404;
    }

    if (
      message.includes('blocked') ||
      message.includes('limit') ||
      message.includes('closed') ||
      message.includes('inactive')
    ) {
      return 422;
    }

    return undefined;
  }
}
