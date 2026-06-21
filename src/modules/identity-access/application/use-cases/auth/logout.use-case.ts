import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../../shared-kernel';
import {
  AUTH_PROVIDER,
  AuthProviderPort,
  LogoutCommand,
} from '../../../domain';

export type LogoutResult = {
  signedOut: true;
};

@Injectable()
export class LogoutUseCase extends UseCase<
  LogoutCommand,
  LogoutResult,
  AppError
> {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
  ) {
    super();
  }

  async execute(input: LogoutCommand): Promise<Result<LogoutResult, AppError>> {
    try {
      await this.authProvider.signOut(input.accessToken);

      return Result.success({ signedOut: true });
    } catch (error) {
      return ErrorFactory.useCase('Could not sign out', error, 401);
    }
  }
}
