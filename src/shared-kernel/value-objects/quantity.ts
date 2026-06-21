import { DomainError, ErrorFactory } from '../domain/exceptions';
import { Result } from '../domain/result';

export class Quantity {
  private readonly normalizedValue: number;

  constructor(value: number) {
    const validationResult = this.validate(value);
    if (validationResult.isFailure) throw validationResult.error;

    this.normalizedValue = value;
  }

  get value(): number {
    return this.normalizedValue;
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }

  subtract(other: Quantity): Result<Quantity, DomainError> {
    const result = this.value - other.value;

    if (result < 0) {
      return ErrorFactory.domain('Cannot subtract: result would be negative');
    }

    return Result.success(new Quantity(result));
  }

  isZero(): boolean {
    return this.value === 0;
  }

  isPositive(): boolean {
    return this.value > 0;
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }

  private validate(value: number): Result<void, DomainError> {
    if (!Number.isInteger(value)) {
      return ErrorFactory.domain('Quantity must be an integer');
    }
    if (value < 0) {
      return ErrorFactory.domain('Quantity cannot be negative');
    }

    return Result.success(undefined);
  }

  static zero(): Quantity {
    return new Quantity(0);
  }

  static from(value: number): Quantity {
    return new Quantity(value);
  }
}
