import { NumberLimitsHttpMapper } from './number-limits-http.mapper';

describe('NumberLimitsHttpMapper', () => {
  it('maps create dto into an application command', () => {
    expect(
      NumberLimitsHttpMapper.toCreateCommand({
        sellerId: 'seller-id',
        drawCode: 'nacional-11am',
        numbers: ['02', '15'],
        limitMiles: 100,
        validFrom: '2026-06-22',
      }),
    ).toEqual({
      sellerId: 'seller-id',
      drawConfigurationId: undefined,
      drawCode: 'nacional-11am',
      numbers: ['02', '15'],
      limitMiles: 100,
      validFrom: '2026-06-22',
      validUntil: undefined,
    });
  });

  it('maps list query with pagination and filters', () => {
    expect(
      NumberLimitsHttpMapper.toListQuery({
        sellerScope: 'GLOBAL',
        drawScope: 'DRAW',
        active: true,
        validOn: '2026-06-22',
        page: 2,
        limit: 10,
        sortBy: 'number',
        sortDirection: 'asc',
      }),
    ).toEqual({
      sellerId: undefined,
      drawConfigurationId: undefined,
      drawCode: undefined,
      number: undefined,
      sellerScope: 'GLOBAL',
      drawScope: 'DRAW',
      active: true,
      validOn: '2026-06-22',
      page: 2,
      limit: 10,
      sortBy: 'number',
      sortDirection: 'asc',
    });
  });

  it('maps update dto into an application command', () => {
    expect(
      NumberLimitsHttpMapper.toUpdateCommand('limit-id', {
        sellerId: null,
        drawConfigurationId: null,
        number: '02',
        limitMiles: 75,
      }),
    ).toEqual({
      limitId: 'limit-id',
      sellerId: null,
      drawConfigurationId: null,
      drawCode: undefined,
      number: '02',
      limitMiles: 75,
      validFrom: undefined,
      validUntil: undefined,
    });
  });

  it('maps expire dto into an application command', () => {
    expect(
      NumberLimitsHttpMapper.toExpireCommand('limit-id', {
        expiresOn: '2026-06-22',
      }),
    ).toEqual({
      limitId: 'limit-id',
      expiresOn: '2026-06-22',
    });
  });
});
