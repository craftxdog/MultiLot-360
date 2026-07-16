import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmSellerAccessCodeDto } from './seller-access-code.dto';

describe('ConfirmSellerAccessCodeDto', () => {
  const password = 'Sup3rSecret2026!';

  it('accepts the opaque action-token flow', async () => {
    const dto = plainToInstance(ConfirmSellerAccessCodeDto, {
      actionToken: 'A'.repeat(43),
      password,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('keeps the email and six-digit code flow as a manual fallback', async () => {
    const dto = plainToInstance(ConfirmSellerAccessCodeDto, {
      email: 'SELLER@example.com',
      accessCode: '123456',
      password,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('seller@example.com');
  });

  it.each([
    { password },
    { actionToken: 'too-short', password },
    { email: 'seller@example.com', password },
    { accessCode: '123456', password },
  ])('rejects incomplete or malformed credentials: %o', async (payload) => {
    const dto = plainToInstance(ConfirmSellerAccessCodeDto, payload);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
