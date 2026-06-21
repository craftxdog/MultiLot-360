import { SellerOnboardingRepository } from '../../domain';
import { MailerPort } from '../../domain/ports';
import { SellerAccessCodeService } from '../services';
import { CreateSellerInvitationUseCase } from './create-seller-invitation.use-case';

describe('CreateSellerInvitationUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
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

  let useCase: CreateSellerInvitationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeService.generate.mockReturnValue('123456');
    accessCodeService.hash.mockReturnValue('hashed-code');
    accessCodeService.expiresAt.mockReturnValue(
      new Date('2026-06-21T08:15:00.000Z'),
    );
    repository.createInvitation.mockResolvedValue({
      userId: 'user-id',
      sellerId: 'seller-id',
      email: 'seller@example.com',
      sellerName: 'Seller',
      expiresAt: new Date('2026-06-21T08:15:00.000Z'),
    });
    useCase = new CreateSellerInvitationUseCase(
      repository,
      mailer,
      accessCodeService,
    );
  });

  it('persists the invitation and sends the code by email', async () => {
    const result = await useCase.execute({
      email: 'SELLER@example.com',
      username: 'seller.01',
      sellerName: 'Seller',
      documentId: '001-010190-0001A',
      adminName: 'Admin',
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.createInvitation.mock.calls[0][0]).toMatchObject({
      email: 'seller@example.com',
      username: 'seller.01',
      accessCodeHash: 'hashed-code',
    });
    expect(mailer.sendSellerInvitation.mock.calls).toHaveLength(1);
  });
});
