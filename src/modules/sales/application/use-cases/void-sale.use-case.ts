import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { Sale } from '../../domain/entities';
import { SALES_REPOSITORY, SalesRepository } from '../../domain/ports';

export type VoidSaleCommand = {
  saleId: string;
  voidedByUserId?: string;
  reason: string;
  currentSellerId?: string;
  actorRoleName?: string;
};

@Injectable()
export class VoidSaleUseCase extends UseCase<VoidSaleCommand, Sale, AppError> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async execute(input: VoidSaleCommand): Promise<Result<Sale, AppError>> {
    try {
      if (!input.voidedByUserId) {
        return ErrorFactory.useCase(
          'Authenticated user is required',
          undefined,
          401,
        );
      }

      const sale = await this.salesRepository.findById(input.saleId);

      if (!sale) {
        return ErrorFactory.useCase('Sale not found', undefined, 404);
      }

      if (sale.status === 'ANULADA') {
        return ErrorFactory.useCase('Sale is already voided', undefined, 409);
      }

      if (!this.canVoidSale(sale, input)) {
        return ErrorFactory.useCase(
          'Sellers can only void their own sales',
          undefined,
          403,
        );
      }

      const voidedSale = await this.salesRepository.void({
        saleId: input.saleId,
        voidedByUserId: input.voidedByUserId,
        reason: input.reason,
      });

      if (!voidedSale) {
        return ErrorFactory.useCase('Sale not found', undefined, 404);
      }

      return Result.success(voidedSale);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not void sale',
        error,
      );
    }
  }

  private canVoidSale(sale: Sale, input: VoidSaleCommand): boolean {
    return (
      this.isAdmin(input.actorRoleName) ||
      Boolean(input.currentSellerId && sale.seller.id === input.currentSellerId)
    );
  }

  private isAdmin(roleName?: string): boolean {
    return roleName?.toUpperCase() === 'ADMIN';
  }
}
