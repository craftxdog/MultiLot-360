export type NumericValue =
  | number
  | string
  | { toNumber(): number }
  | null
  | undefined;

const MONEY_SCALE = 100;

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

export const toMoneyNumber = (value: NumericValue): number => {
  if (value === null || value === undefined) return 0;

  const amount =
    typeof value === 'object' && 'toNumber' in value
      ? value.toNumber()
      : Number(value);

  if (!Number.isFinite(amount)) {
    throw new TypeError('Money value must be a finite number');
  }

  return roundMoney(amount);
};

export const addMoney = (...values: NumericValue[]): number =>
  values.reduce<number>(
    (total, value) => roundMoney(total + toMoneyNumber(value)),
    0,
  );
