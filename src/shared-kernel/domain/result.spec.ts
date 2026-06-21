import { DomainError } from './exceptions';
import { isFailure, isResult, isSuccess, Result } from './result';

describe('Result', () => {
  it('creates success results', () => {
    const result = Result.success({ id: 'sale-id' });

    expect(isSuccess(result)).toBe(true);
    expect(isFailure(result)).toBe(false);
    expect(isResult(result)).toBe(true);
    expect(result.value).toEqual({ id: 'sale-id' });
  });

  it('creates failure results', () => {
    const error = new DomainError('Invalid sale');
    const result = Result.failure(error);

    expect(isSuccess(result)).toBe(false);
    expect(isFailure(result)).toBe(true);
    expect(isResult(result)).toBe(true);
    expect(result.error).toBe(error);
  });
});
