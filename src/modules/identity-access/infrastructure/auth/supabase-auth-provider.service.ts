import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvConfigService } from '../../../../config/env-config.service';
import {
  AdminResetPasswordInput,
  AuthProviderPort,
  AuthProviderSession,
  AuthProviderUser,
  CreateAuthUserInput,
  GeneratePasswordRecoveryCodeInput,
  PasswordRecoveryCode,
  ResetPasswordWithRecoveryCodeInput,
  SignInWithPasswordInput,
  SupabaseJwtPayload,
} from '../../domain';

@Injectable()
export class SupabaseAuthProviderService implements AuthProviderPort {
  private userClient?: SupabaseClient;
  private adminClient?: SupabaseClient;

  constructor(private readonly envConfig: EnvConfigService) {}

  async createUser(input: CreateAuthUserInput): Promise<AuthProviderUser> {
    const { data, error } = await this.getAdminClient().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: input.emailConfirmed ?? true,
      user_metadata: {
        name: input.name,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user.email) {
      throw new Error('Supabase user email was not returned');
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  }

  async deleteUser(authUserId: string): Promise<void> {
    const { error } =
      await this.getAdminClient().auth.admin.deleteUser(authUserId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async signInWithPassword(
    input: SignInWithPasswordInput,
  ): Promise<AuthProviderSession> {
    const { data, error } = await this.getUserClient().auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.toSession(data.session?.access_token, data.session);
  }

  async refreshSession(refreshToken: string): Promise<AuthProviderSession> {
    const { data, error } = await this.getUserClient().auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.toSession(data.session?.access_token, data.session);
  }

  async signOut(accessToken: string): Promise<void> {
    const { error } = await this.getAdminClient().auth.admin.signOut(
      accessToken,
      'global',
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async generatePasswordRecoveryCode(
    input: GeneratePasswordRecoveryCodeInput,
  ): Promise<PasswordRecoveryCode> {
    const { data, error } = await this.getAdminClient().auth.admin.generateLink(
      {
        type: 'recovery',
        email: input.email,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data.properties.email_otp || !data.user.id) {
      throw new Error('Supabase recovery code was not returned');
    }

    return {
      authUserId: data.user.id,
      code: data.properties.email_otp,
    };
  }

  async resetPasswordWithRecoveryCode(
    input: ResetPasswordWithRecoveryCodeInput,
  ): Promise<{ authUserId: string }> {
    return this.updatePasswordWithRecoveryCode(
      input.email,
      input.code,
      input.newPassword,
    );
  }

  async adminResetPassword(
    input: AdminResetPasswordInput,
  ): Promise<{ authUserId: string }> {
    const admin = this.getAdminClient().auth.admin;
    const { data: userData, error: userError } = await admin.getUserById(
      input.authUserId,
    );

    if (userError || !userData.user?.email) {
      throw new Error(userError?.message ?? 'Target auth user was not found');
    }

    const recovery = await this.generatePasswordRecoveryCode({
      email: userData.user.email,
    });

    if (recovery.authUserId !== input.authUserId) {
      throw new Error('Generated recovery code belongs to another user');
    }

    return this.updatePasswordWithRecoveryCode(
      userData.user.email,
      recovery.code,
      input.newPassword,
      input.authUserId,
    );
  }

  private async updatePasswordWithRecoveryCode(
    email: string,
    code: string,
    newPassword: string,
    expectedAuthUserId?: string,
  ): Promise<{ authUserId: string }> {
    const client = this.createSupabaseClient(
      this.requireConfig(
        this.envConfig.supabase.publishableKey,
        'SUPABASE_PUBLISHABLE_KEY',
      ),
    );
    const { data: sessionData, error: sessionError } =
      await client.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });

    if (sessionError || !sessionData.session || !sessionData.user) {
      throw new Error(
        `RECOVERY_CODE_INVALID: ${
          sessionError?.message ?? 'Recovery code is invalid'
        }`,
      );
    }

    if (expectedAuthUserId && sessionData.user.id !== expectedAuthUserId) {
      throw new Error('Recovery code belongs to another user');
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: signOutError } =
      await this.getAdminClient().auth.admin.signOut(
        sessionData.session.access_token,
        'global',
      );

    if (signOutError) {
      throw new Error(`SESSION_REVOCATION_FAILED: ${signOutError.message}`);
    }

    return { authUserId: sessionData.user.id };
  }

  async verifyAccessToken(accessToken: string): Promise<SupabaseJwtPayload> {
    const { data, error } =
      await this.getUserClient().auth.getUser(accessToken);

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Supabase user was not returned');
    }

    return {
      sub: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      role: data.user.role,
      app_metadata: data.user.app_metadata,
      user_metadata: data.user.user_metadata,
    };
  }

  private toSession(
    accessToken: string | undefined,
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      user: { id: string };
    } | null,
  ): AuthProviderSession {
    if (!accessToken || !session) {
      throw new Error('Supabase session was not returned');
    }

    return {
      accessToken,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      tokenType: 'bearer',
      authUserId: session.user.id,
    };
  }

  private requireConfig(value: string, envName: string): string {
    if (!value) {
      throw new Error(`${envName} is required`);
    }

    return value;
  }

  private getUserClient(): SupabaseClient {
    if (!this.userClient) {
      this.userClient = this.createSupabaseClient(
        this.requireConfig(
          this.envConfig.supabase.publishableKey,
          'SUPABASE_PUBLISHABLE_KEY',
        ),
      );
    }

    return this.userClient;
  }

  private getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.adminClient = this.createSupabaseClient(
        this.requireConfig(
          this.envConfig.supabase.serviceRoleKey,
          'SUPABASE_SERVICE_ROLE_KEY',
        ),
      );
    }

    return this.adminClient;
  }

  private createSupabaseClient(apiKey: string): SupabaseClient {
    const client: unknown = createClient(this.envConfig.supabase.url, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return client as SupabaseClient;
  }
}
