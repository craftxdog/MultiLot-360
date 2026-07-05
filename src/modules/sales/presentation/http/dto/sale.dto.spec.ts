import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaleItemDto } from './sale.dto';

describe('SaleItemDto decimal validation', () => {
  it.each([0.5, 1.4, 23.75])(
    'accepts %s with up to two decimals',
    async (amount) => {
      const dto = plainToInstance(SaleItemDto, {
        number: '45',
        prizeMiles: amount,
      });

      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each([0, -0.5, 1.234])('rejects invalid amount %s', async (amount) => {
    const dto = plainToInstance(SaleItemDto, {
      number: '45',
      prizeMiles: amount,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
