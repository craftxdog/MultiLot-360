import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import { SystemParameter } from '../../domain/entities';
import {
  SYSTEM_PARAMETERS_REPOSITORY,
  SystemParametersRepository,
} from '../../domain/ports';
import {
  isValidSystemParameterKey,
  normalizeSystemParameterKey,
} from './system-parameter-key';

export type GetSystemParameterQuery = {
  key: string;
};

@Injectable()
export class GetSystemParameterUseCase extends UseCase<
  GetSystemParameterQuery,
  SystemParameter,
  AppError
> {
  constructor(
    @Inject(SYSTEM_PARAMETERS_REPOSITORY)
    private readonly systemParametersRepository: SystemParametersRepository,
  ) {
    super();
  }

  async execute(
    input: GetSystemParameterQuery,
  ): Promise<Result<SystemParameter, AppError>> {
    try {
      const key = normalizeSystemParameterKey(input.key);

      if (!isValidSystemParameterKey(key)) {
        return ErrorFactory.useCase(
          'Invalid system parameter key',
          undefined,
          400,
        );
      }

      const parameter = await this.systemParametersRepository.findByKey(key);

      if (!parameter) {
        return ErrorFactory.useCase(
          'System parameter not found',
          undefined,
          404,
        );
      }

      return Result.success(parameter);
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not get system parameter',
        error,
      );
    }
  }
}
