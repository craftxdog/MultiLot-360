import { DomainError, ErrorFactory } from '../domain/exceptions';
import { Result } from '../domain/result';

export class Money {
  private readonly normalizedAmount: number;
  private readonly normalizedCurrency: string;

  constructor(amount: number, currency = 'NIO') {
    const validationResult = this.validate(amount, currency);
    if (validationResult.isFailure) throw validationResult.error;

    this.normalizedAmount = Math.round(amount * 100) / 100;
    this.normalizedCurrency = currency.trim().toUpperCase();
  }

  get amount(): number {
    return this.normalizedAmount;
  }

  get value(): number {
    return this.normalizedAmount;
  }

  get currency(): string {
    return this.normalizedCurrency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Result<Money, DomainError> {
    this.assertSameCurrency(other);
    const result = this.amount - other.amount;

    if (result < 0) {
      return ErrorFactory.domain('Cannot subtract: result would be negative');
    }

    return Result.success(new Money(result, this.currency));
  }

  multiply(quantity: number): Money {
    if (quantity < 0) {
      throw new DomainError('Cannot multiply money by negative quantity');
    }

    return new Money(this.amount * quantity, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  private validate(
    amount: number,
    currency: string,
  ): Result<void, DomainError> {
    if (!Number.isFinite(amount)) {
      return ErrorFactory.domain('Amount must be a finite number');
    }
    if (amount < 0) {
      return ErrorFactory.domain('Amount cannot be negative');
    }
    if (!currency?.trim()) {
      return ErrorFactory.domain('Currency is required');
    }
    if (currency.trim().length !== 3) {
      return ErrorFactory.domain('Currency must be a 3-letter ISO code');
    }

    return Result.success(undefined);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError('Cannot operate with different currencies');
    }
  }

  static zero(currency = 'NIO'): Money {
    return new Money(0, currency);
  }

  static from(amount: number, currency = 'NIO'): Money {
    return new Money(amount, currency);
  }
}
