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
  UpsertSystemParameterInput,
} from '../../domain/ports';
import {
  isValidSystemParameterKey,
  normalizeSystemParameterKey,
} from './system-parameter-key';

export type UpsertSystemParameterCommand = UpsertSystemParameterInput;

@Injectable()
export class UpsertSystemParameterUseCase extends UseCase<
  UpsertSystemParameterCommand,
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
    input: UpsertSystemParameterCommand,
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

      return Result.success(
        await this.systemParametersRepository.upsert({
          key,
          value: input.value,
        }),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error
          ? error.message
          : 'Could not save system parameter',
        error,
      );
    }
  }
}
