import { SellerOnboardingRepository } from '../../domain';
import { SellerAccessCodeService } from '../services';
import { ConfirmSellerAccessCodeUseCase } from './confirm-seller-access-code.use-case';

describe('ConfirmSellerAccessCodeUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    createInvitation: jest.fn(),
    confirmAccessCode: jest.fn(),
  };
  const accessCodeService = {
    hash: jest.fn(),
  } as unknown as jest.Mocked<SellerAccessCodeService>;
  let useCase: ConfirmSellerAccessCodeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeService.hash.mockReturnValue('hashed-code');
    useCase = new ConfirmSellerAccessCodeUseCase(repository, accessCodeService);
  });

  it('fails when the code cannot be confirmed', async () => {
    repository.confirmAccessCode.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'seller@example.com',
      accessCode: '123456',
      authUserId: 'auth-user-id',
    });

    expect(result.isFailure).toBe(true);
  });

  it('returns confirmed seller access', async () => {
    repository.confirmAccessCode.mockResolvedValue({
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
    });

    const result = await useCase.execute({
      email: 'seller@example.com',
      accessCode: '123456',
      authUserId: 'auth-user-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.confirmAccessCode.mock.calls[0][0]).toEqual({
      email: 'seller@example.com',
      accessCodeHash: 'hashed-code',
      authUserId: 'auth-user-id',
    });
  });
});
