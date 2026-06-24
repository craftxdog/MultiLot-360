import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  SALES_REPOSITORY,
  SalesRepository,
  SalesVoidPolicy,
} from '../../domain/ports';

@Injectable()
export class GetSalesVoidPolicyUseCase extends UseCase<
  void,
  SalesVoidPolicy,
  AppError
> {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async execute(): Promise<Result<SalesVoidPolicy, AppError>> {
    try {
      return Result.success(await this.salesRepository.getVoidPolicy());
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not get sales void policy',
        error,
      );
    }
  }
}
