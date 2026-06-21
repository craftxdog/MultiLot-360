import { ResolveRequestIdentityUseCase } from './resolve-request-identity.use-case';
import { IdentityAccessRepository } from '../../domain';

describe('ResolveRequestIdentityUseCase', () => {
  const repository: jest.Mocked<IdentityAccessRepository> = {
    findByAuthUserId: jest.fn(),
  };
  let useCase: ResolveRequestIdentityUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ResolveRequestIdentityUseCase(repository);
  });

  it('fails when Supabase subject is missing', async () => {
    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(repository.findByAuthUserId.mock.calls).toHaveLength(0);
  });

  it('fails when authenticated user is not registered internally', async () => {
    repository.findByAuthUserId.mockResolvedValue(null);

    const result = await useCase.execute({ sub: 'auth-user-id' });

    expect(result.isFailure).toBe(true);
    expect(repository.findByAuthUserId.mock.calls).toEqual([['auth-user-id']]);
  });

  it('resolves an active identity', async () => {
    repository.findByAuthUserId.mockResolvedValue({
      id: 'user-id',
      authUserId: 'auth-user-id',
      username: 'admin',
      active: true,
      role: {
        id: 'role-id',
        name: 'admin',
      },
      modules: ['ventas'],
      permissions: ['ventas.read'],
    });

    const result = await useCase.execute({ sub: 'auth-user-id' });

    expect(result.isSuccess).toBe(true);
    if (result.isFailure) {
      throw result.error;
    }
    expect(result.value.user.username).toBe('admin');
  });
});
