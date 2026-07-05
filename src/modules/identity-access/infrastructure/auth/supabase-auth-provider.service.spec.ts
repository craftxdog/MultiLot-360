import { createClient } from '@supabase/supabase-js';
import { EnvConfigService } from '../../../../config/env-config.service';
import { SupabaseAuthProviderService } from './supabase-auth-provider.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient);
const asClient = (value: unknown): ReturnType<typeof createClient> =>
  value as ReturnType<typeof createClient>;

const env = {
  supabase: {
    url: 'https://project.supabase.co',
    publishableKey: 'publishable-key',
    serviceRoleKey: 'service-role-key',
  },
  auth: {
    passwordResetUrl: 'https://app.example.com/restablecer-contrasena',
  },
} as EnvConfigService;

describe('SupabaseAuthProviderService password recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a recovery OTP without sending the Supabase email', async () => {
    const generateLink = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'auth-user-id' },
        properties: { email_otp: '123456' },
      },
      error: null,
    });
    mockedCreateClient.mockReturnValue(
      asClient({ auth: { admin: { generateLink } } }),
    );
    const service = new SupabaseAuthProviderService(env);

    const recovery = await service.generatePasswordRecoveryCode({
      email: 'user@example.com',
    });

    expect(generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'user@example.com',
    });
    expect(recovery).toEqual({ authUserId: 'auth-user-id', code: '123456' });
  });

  it('verifies the recovery OTP, updates the password and revokes sessions', async () => {
    const verifyOtp = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'auth-user-id' },
        session: { access_token: 'current-access-token' },
      },
      error: null,
    });
    const updateUser = jest.fn().mockResolvedValue({ error: null });
    const signOut = jest.fn().mockResolvedValue({ error: null });
    mockedCreateClient
      .mockReturnValueOnce(asClient({ auth: { verifyOtp, updateUser } }))
      .mockReturnValueOnce(asClient({ auth: { admin: { signOut } } }));
    const service = new SupabaseAuthProviderService(env);

    const result = await service.resetPasswordWithRecoveryCode({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'NuevaClave2026!',
    });

    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'recovery',
    });
    expect(updateUser).toHaveBeenCalledWith({
      password: 'NuevaClave2026!',
    });
    expect(signOut).toHaveBeenCalledWith('current-access-token', 'global');
    expect(result).toEqual({ authUserId: 'auth-user-id' });
  });

  it('rejects an invalid recovery code before changing the password', async () => {
    const updateUser = jest.fn();
    mockedCreateClient.mockReturnValue(
      asClient({
        auth: {
          verifyOtp: jest.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: new Error('Token has expired or is invalid'),
          }),
          updateUser,
        },
      }),
    );
    const service = new SupabaseAuthProviderService(env);

    await expect(
      service.resetPasswordWithRecoveryCode({
        email: 'user@example.com',
        code: '000000',
        newPassword: 'NuevaClave2026!',
      }),
    ).rejects.toThrow('RECOVERY_CODE_INVALID: Token has expired or is invalid');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('lets an admin reset a target through a server-side recovery session', async () => {
    const getUserById = jest.fn().mockResolvedValue({
      data: { user: { id: 'auth-user-id', email: 'user@example.com' } },
      error: null,
    });
    const generateLink = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'auth-user-id' },
        properties: { email_otp: '654321' },
      },
      error: null,
    });
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const verifyOtp = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'auth-user-id' },
        session: { access_token: 'target-access-token' },
      },
      error: null,
    });
    const updateUser = jest.fn().mockResolvedValue({ error: null });
    mockedCreateClient
      .mockReturnValueOnce(
        asClient({
          auth: { admin: { getUserById, generateLink, signOut } },
        }),
      )
      .mockReturnValueOnce(asClient({ auth: { verifyOtp, updateUser } }));
    const service = new SupabaseAuthProviderService(env);

    await service.adminResetPassword({
      authUserId: 'auth-user-id',
      newPassword: 'NuevaClave2026!',
    });

    expect(getUserById).toHaveBeenCalledWith('auth-user-id');
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'recovery',
        email: 'user@example.com',
      }),
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '654321',
      type: 'recovery',
    });
    expect(signOut).toHaveBeenCalledWith('target-access-token', 'global');
  });
});
