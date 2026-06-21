import { SellerOnboardingRepository } from '../../domain';
import { MailerPort } from '../../domain/ports';
import { SellerAccessCodeService } from '../services';
import { ResendSellerAccessCodeUseCase } from './resend-seller-access-code.use-case';

describe('ResendSellerAccessCodeUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    listInvitations: jest.fn(),
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
    revokeInvitation: jest.fn(),
    findPendingAccessCode: jest.fn(),
    confirmAccessCode: jest.fn(),
  };
  const mailer: jest.Mocked<MailerPort> = {
    sendSellerInvitation: jest.fn(),
    sendSellerAccessCode: jest.fn(),
    sendAccountConfirmation: jest.fn(),
  };
  const accessCodeService = {
    generate: jest.fn(),
    hash: jest.fn(),
    expiresAt: jest.fn(),
  } as unknown as jest.Mocked<SellerAccessCodeService>;

  let useCase: ResendSellerAccessCodeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeService.generate.mockReturnValue('654321');
    accessCodeService.hash.mockReturnValue('hashed-new-code');
    accessCodeService.expiresAt.mockReturnValue(
      new Date('2026-06-21T08:15:00.000Z'),
    );
    repository.resendAccessCode.mockResolvedValue({
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
      sellerName: 'Seller',
      expiresAt: new Date('2026-06-21T08:15:00.000Z'),
    });
    useCase = new ResendSellerAccessCodeUseCase(
      repository,
      mailer,
      accessCodeService,
    );
  });

  it('generates a fresh code and sends it by email', async () => {
    const result = await useCase.execute({
      email: 'SELLER@example.com',
      adminUserId: 'admin-id',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.resendAccessCode.mock.calls[0][0]).toMatchObject({
      email: 'seller@example.com',
      adminUserId: 'admin-id',
      accessCodeHash: 'hashed-new-code',
    });
    expect(mailer.sendSellerAccessCode.mock.calls[0][0]).toMatchObject({
      recipient: {
        email: 'seller@example.com',
        name: 'Seller',
      },
      sellerName: 'Seller',
      accessCode: '654321',
    });
  });

  it('fails when there is no previous invitation for the email', async () => {
    repository.resendAccessCode.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'missing@example.com',
    });

    expect(result.isFailure).toBe(true);
    expect(mailer.sendSellerAccessCode.mock.calls).toHaveLength(0);
  });
});
