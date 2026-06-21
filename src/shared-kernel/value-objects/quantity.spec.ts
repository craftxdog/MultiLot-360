import { DomainError } from '../domain';
import { Quantity } from './quantity';

describe('Quantity', () => {
  it('creates non-negative integer quantities', () => {
    const quantity = Quantity.from(5);

    expect(quantity.value).toBe(5);
    expect(quantity.isPositive()).toBe(true);
  });

  it('does not allow decimal quantities', () => {
    expect(() => Quantity.from(1.5)).toThrow(DomainError);
  });

  it('returns a failure when subtraction would be negative', () => {
    const result = Quantity.from(1).subtract(Quantity.from(2));

    expect(result.isFailure).toBe(true);
  });
});
