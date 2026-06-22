export type NumberLimitSellerScope = 'GLOBAL' | 'SELLER';
export type NumberLimitDrawScope = 'DEFAULT' | 'DRAW';

export type NumberLimitSeller = {
  id: string;
  name: string;
} | null;

export type NumberLimitDrawConfiguration = {
  id: string;
  code: string;
  time: string;
} | null;

export type NumberLimit = {
  id: string;
  sellerScope: NumberLimitSellerScope;
  drawScope: NumberLimitDrawScope;
  seller: NumberLimitSeller;
  drawConfiguration: NumberLimitDrawConfiguration;
  number: string;
  limitMiles: number;
  validFrom: string;
  validUntil: string | null;
  createdAt: Date;
};
