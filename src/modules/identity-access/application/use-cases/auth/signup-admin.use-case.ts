import { Inject, Injectable } from '@nestjs/common';
import { EnvConfigService } from '../../../../../config/env-config.service';
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
  SignupAdminCommand,
} from '../../../domain';

@Injectable()
export class SignupAdminUseCase extends UseCase<
  SignupAdminCommand,
  AuthSession,
  AppError
> {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
    @Inject(AUTH_ACCOUNT_REPOSITORY)
    private readonly authAccountRepository: AuthAccountRepository,
    private readonly envConfig: EnvConfigService,
  ) {
    super();
  }

  async execute(
    input: SignupAdminCommand,
  ): Promise<Result<AuthSession, AppError>> {
    if (!this.envConfig.auth.signupEnabled) {
      return ErrorFactory.useCase('Signup is disabled', undefined, 403);
    }

    const email = input.email.trim().toLowerCase();
    let authUserId: string | undefined;

    try {
      const authUser = await this.authProvider.createUser({
        email,
        password: input.password,
        name: input.name,
        emailConfirmed: true,
      });
      authUserId = authUser.id;

      const user = await this.authAccountRepository.createInternalUser({
        authUserId: authUser.id,
        email,
        username: input.username.trim().toLowerCase(),
        name: input.name,
        roleName: this.envConfig.auth.adminRoleName,
      });
      const session = await this.authProvider.signInWithPassword({
        email,
        password: input.password,
      });

      return Result.success({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        tokenType: session.tokenType,
        user,
      });
    } catch (error) {
      if (authUserId) {
        await this.safeDeleteAuthUser(authUserId);
      }

      return ErrorFactory.useCase('Could not sign up admin user', error);
    }
  }

  private async safeDeleteAuthUser(authUserId: string): Promise<void> {
    try {
      await this.authProvider.deleteUser(authUserId);
    } catch {
      // Best effort cleanup. The original signup error is more useful upstream.
    }
  }
}
