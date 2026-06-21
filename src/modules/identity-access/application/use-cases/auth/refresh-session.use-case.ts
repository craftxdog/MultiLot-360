import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  Result,
  UseCase,
} from '../../../../../shared-kernel';
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_PROVIDER,
  AuthAccountRepository,
  AuthProviderPort,
  AuthSession,
  RefreshSessionCommand,
} from '../../../domain';

@Injectable()
export class RefreshSessionUseCase extends UseCase<
  RefreshSessionCommand,
  AuthSession,
  AppError
> {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
    @Inject(AUTH_ACCOUNT_REPOSITORY)
    private readonly authAccountRepository: AuthAccountRepository,
  ) {
    super();
  }

  async execute(
    input: RefreshSessionCommand,
  ): Promise<Result<AuthSession, AppError>> {
    try {
      const session = await this.authProvider.refreshSession(
        input.refreshToken,
      );
      const user = await this.authAccountRepository.findByAuthUserId(
        session.authUserId,
      );

      if (!user) {
        return ErrorFactory.useCase(
          'Authenticated user is not registered',
          undefined,
          401,
        );
      }

      if (!user.active) {
        return ErrorFactory.useCase(
          'Authenticated user is inactive',
          undefined,
          403,
        );
      }

      return Result.success({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        tokenType: session.tokenType,
        user,
      });
    } catch (error) {
      return ErrorFactory.useCase('Invalid refresh token', error, 401);
    }
  }
}
