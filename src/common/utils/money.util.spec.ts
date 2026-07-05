import { addMoney, roundMoney, toMoneyNumber } from './money.util';

describe('money utilities', () => {
  it('keeps decimal additions stable at two places', () => {
    expect(addMoney(0.1, 0.2, 1.4)).toBe(1.7);
  });

  it('converts Prisma-like decimal values to JSON-safe numbers', () => {
    expect(toMoneyNumber({ toNumber: () => 0.5 })).toBe(0.5);
  });

  it('rounds only at the supported money scale', () => {
    expect(roundMoney(12.345)).toBe(12.35);
  });
});
