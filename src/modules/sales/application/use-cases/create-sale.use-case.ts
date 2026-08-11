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
import { addMoney } from '../../../../common';
import { Sale } from '../../domain/entities';
import {
  SALES_REPOSITORY,
  SaleItemInput,
  SaleAttribution,
  SalesRepository,
} from '../../domain/ports';

export type CreateSaleCommand = {
  requestedSellerId?: string;
  currentSellerId?: string;
  actorRoleName?: string;
  actorUserId?: string;
  actorMembershipId?: string;
  shiftId: string;
  items: SaleItemInput[];
};

const SELLER_ASSIGNMENT_REQUIRED_MESSAGE =
  'A seller profile is required to create sales';
const ADMIN_MEMBERSHIP_REQUIRED_MESSAGE =
  'An active tenant membership is required to create an admin sale';

@Injectable()
export class CreateSaleUseCase extends UseCase<
  CreateSaleCommand,
  Sale,
  AppError
> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(input: CreateSaleCommand): Promise<Result<Sale, AppError>> {
    try {
      const attributionResult = this.resolveAttribution(input);

      if (attributionResult.isFailure) {
        return attributionResult;
      }

      const items = this.normalizeItems(input.items);

      if (items.length === 0) {
        return ErrorFactory.useCase(
          'At least one sale item is required',
          undefined,
          400,
        );
      }

      const sale = await this.salesRepository.create({
        attribution: attributionResult.value,
        shiftId: input.shiftId,
        items,
      });

      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.saleCreated,
        aggregateId: sale.id,
        audience: operationalAudience.sales(sale.seller.id),
        payload: {
          saleId: sale.id,
          sellerId: sale.seller.id,
          shiftId: sale.shift?.id ?? null,
          status: sale.status,
          totalMiles: sale.totalMiles,
          numbers: sale.details.map((detail) => detail.number),
          items: sale.details.map((detail) => ({
            number: detail.number,
            prizeMiles: detail.prizeMiles,
          })),
        },
      });

      return Result.success(sale);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create sale',
        error,
        this.toHttpStatus(error),
      );
    }
  }

  private resolveAttribution(
    input: Pick<
      CreateSaleCommand,
      | 'actorMembershipId'
      | 'actorRoleName'
      | 'actorUserId'
      | 'currentSellerId'
      | 'requestedSellerId'
    >,
  ): Result<SaleAttribution, AppError> {
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

    if (sellerId) {
      return Result.success({ kind: 'SELLER', sellerId });
    }

    if (this.isAdmin(input.actorRoleName)) {
      if (!input.actorUserId || !input.actorMembershipId) {
        return ErrorFactory.useCase(
          ADMIN_MEMBERSHIP_REQUIRED_MESSAGE,
          undefined,
          403,
        );
      }

      return Result.success({
        kind: 'ADMIN_SELF',
        userId: input.actorUserId,
        membershipId: input.actorMembershipId,
      });
    }

    return ErrorFactory.useCase(
      SELLER_ASSIGNMENT_REQUIRED_MESSAGE,
      undefined,
      400,
    );
  }

  private normalizeItems(items: SaleItemInput[]): SaleItemInput[] {
    const totalsByNumber = new Map<string, number>();

    for (const item of items) {
      const number = item.number.replace(/\D/g, '').padStart(2, '0');
      totalsByNumber.set(
        number,
        addMoney(totalsByNumber.get(number), item.prizeMiles),
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

    if (message.includes('admin tenant membership')) {
      return 403;
    }

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
