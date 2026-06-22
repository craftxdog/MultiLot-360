import { SalesHttpMapper } from './sales-http.mapper';

describe('SalesHttpMapper', () => {
  it('maps create dto into an application command', () => {
    expect(
      SalesHttpMapper.toCreateCommand(
        {
          shiftId: 'shift-id',
          items: [{ number: '02', prizeMiles: 20 }],
        },
        'seller-id',
        'VENDEDOR',
      ),
    ).toEqual({
      requestedSellerId: undefined,
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
      shiftId: 'shift-id',
      items: [{ number: '02', prizeMiles: 20 }],
    });
  });

  it('maps list query with actor scope into an application query', () => {
    expect(
      SalesHttpMapper.toListQuery(
        {
          date: '2026-06-22',
          drawCode: 'nacional-11am',
          number: '02',
          status: 'ACTIVA',
          page: 2,
          limit: 10,
          sortBy: 'date',
          sortDirection: 'asc',
        },
        'seller-id',
        'VENDEDOR',
      ),
    ).toEqual({
      sellerId: undefined,
      shiftId: undefined,
      date: '2026-06-22',
      drawCode: 'nacional-11am',
      number: '02',
      status: 'ACTIVA',
      page: 2,
      limit: 10,
      sortBy: 'date',
      sortDirection: 'asc',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
    });
  });

  it('maps void dto into an application command', () => {
    expect(
      SalesHttpMapper.toVoidCommand(
        'sale-id',
        { reason: 'Cliente solicito anulacion' },
        'user-id',
        'seller-id',
        'VENDEDOR',
      ),
    ).toEqual({
      saleId: 'sale-id',
      reason: 'Cliente solicito anulacion',
      voidedByUserId: 'user-id',
      currentSellerId: 'seller-id',
      actorRoleName: 'VENDEDOR',
    });
  });
});
