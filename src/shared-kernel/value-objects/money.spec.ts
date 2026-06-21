import { DomainError } from '../domain';
import { Money } from './money';

describe('Money', () => {
  it('normalizes currency and rounds amount', () => {
    const money = Money.from(10.235, 'nio');

    expect(money.amount).toBe(10.24);
    expect(money.currency).toBe('NIO');
  });

  it('does not allow negative amounts', () => {
    expect(() => Money.from(-1)).toThrow(DomainError);
  });

  it('adds amounts with the same currency', () => {
    const total = Money.from(10).add(Money.from(15.5));

    expect(total.amount).toBe(25.5);
    expect(total.currency).toBe('NIO');
  });
});
