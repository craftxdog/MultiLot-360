import { SalesMatrixHttpMapper } from './sales-matrix-http.mapper';

describe('SalesMatrixHttpMapper', () => {
  it('maps all supported administrative filters', () => {
    expect(
      SalesMatrixHttpMapper.toQuery({
        date: '2026-07-01',
        shiftId: 'shift-id',
        drawCode: '11',
        sellerId: 'seller-id',
        status: 'TODAS',
      }),
    ).toEqual({
      date: '2026-07-01',
      shiftId: 'shift-id',
      drawCode: '11',
      sellerId: 'seller-id',
      status: 'TODAS',
    });
  });
});
