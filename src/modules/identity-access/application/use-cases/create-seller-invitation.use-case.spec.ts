import { SellerOnboardingRepository } from '../../domain';
import { MailDeliveryError, MailerPort } from '../../domain/ports';
import { SellerAccessCodeService } from '../services';
import { CreateSellerInvitationUseCase } from './create-seller-invitation.use-case';

describe('CreateSellerInvitationUseCase', () => {
  const repository: jest.Mocked<SellerOnboardingRepository> = {
    listSellers: jest.fn(),
    listInvitations: jest.fn(),
    createInvitation: jest.fn(),
    resendAccessCode: jest.fn(),
    revokeInvitation: jest.fn(),
    findDeletionTarget: jest.fn(),
    softDeleteSeller: jest.fn(),
    hardDeleteSeller: jest.fn(),
    findPendingAccessCode: jest.fn(),
    confirmAccessCode: jest.fn(),
  };
  const mailer: jest.Mocked<MailerPort> = {
    sendSellerInvitation: jest.fn(),
    sendSellerAccessCode: jest.fn(),
    sendAccountConfirmation: jest.fn(),
    sendPasswordRecoveryCode: jest.fn(),
  };
  const accessCodeService = {
    generate: jest.fn(),
    hash: jest.fn(),
    generateActionToken: jest.fn(),
    hashActionToken: jest.fn(),
    expiresAt: jest.fn(),
  } as unknown as jest.Mocked<SellerAccessCodeService>;

  let useCase: CreateSellerInvitationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessCodeService.generate.mockReturnValue('123456');
    accessCodeService.hash.mockReturnValue('hashed-code');
    accessCodeService.generateActionToken.mockReturnValue('opaque-token');
    accessCodeService.hashActionToken.mockReturnValue('hashed-action-token');
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
      actionTokenHash: 'hashed-action-token',
    });
    expect(mailer.sendSellerInvitation.mock.calls[0][0]).toMatchObject({
      accessCode: '123456',
      actionToken: 'opaque-token',
    });
  });

  it('returns a sanitized 502 when SMTP credentials are rejected', async () => {
    mailer.sendSellerInvitation.mockRejectedValue(
      new MailDeliveryError(
        'MailerSend SMTP authentication failed',
        'AUTHENTICATION',
        false,
      ),
    );

    const result = await useCase.execute({
      email: 'seller@example.com',
      username: 'seller.01',
      sellerName: 'Seller',
      documentId: '001-010190-0001A',
      adminName: 'Admin',
    });

    expect(result.isFailure).toBe(true);
    if (result.isSuccess) throw new Error('Expected invitation to fail');
    expect(result.error).toMatchObject({
      statusCode: 502,
      code: 'INFRASTRUCTURE_ERROR',
      retryable: false,
      message: 'No se pudo enviar el correo de invitación. Intenta nuevamente.',
    });
    expect(result.error.message).not.toContain('MailerSend');
  });

  it('returns a retryable 503 when SMTP is temporarily unavailable', async () => {
    mailer.sendSellerInvitation.mockRejectedValue(
      new MailDeliveryError(
        'MailerSend SMTP is temporarily unavailable',
        'UNAVAILABLE',
        true,
      ),
    );

    const result = await useCase.execute({
      email: 'seller@example.com',
      username: 'seller.01',
      sellerName: 'Seller',
      documentId: '001-010190-0001A',
      adminName: 'Admin',
    });

    expect(result.isFailure).toBe(true);
    if (result.isSuccess) throw new Error('Expected invitation to fail');
    expect(result.error).toMatchObject({ statusCode: 503, retryable: true });
  });
});
