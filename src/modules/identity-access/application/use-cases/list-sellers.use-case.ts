import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SellerDirectoryItem } from '../../domain/entities';
import {
  ListSellersQuery,
  SELLER_ONBOARDING_REPOSITORY,
  SellerOnboardingRepository,
} from '../../domain/ports';

@Injectable()
export class ListSellersUseCase extends UseCase<
  ListSellersQuery,
  PaginatedResult<SellerDirectoryItem>,
  AppError
> {
  constructor(
    @Inject(SELLER_ONBOARDING_REPOSITORY)
    private readonly repository: SellerOnboardingRepository,
  ) {
    super();
  }

  async execute(
    input: ListSellersQuery,
  ): Promise<Result<PaginatedResult<SellerDirectoryItem>, AppError>> {
    try {
      return Result.success(await this.repository.listSellers(input));
    } catch (error) {
      return ErrorFactory.useCase('Could not list sellers', error);
    }
  }
}
