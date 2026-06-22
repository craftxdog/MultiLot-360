import { BlockedNumbersHttpMapper } from './blocked-numbers-http.mapper';

describe('BlockedNumbersHttpMapper', () => {
  it('maps create dto into an application command', () => {
    expect(
      BlockedNumbersHttpMapper.toCreateCommand(
        {
          numbers: ['02', '15'],
          date: '2026-06-22',
          reason: 'Decision operativa',
        },
        'user-id',
      ),
    ).toEqual({
      numbers: ['02', '15'],
      date: '2026-06-22',
      shiftId: undefined,
      reason: 'Decision operativa',
      createdByUserId: 'user-id',
    });
  });

  it('maps list query with pagination and filters', () => {
    expect(
      BlockedNumbersHttpMapper.toListQuery({
        number: '02',
        scope: 'SHIFT',
        shiftId: 'shift-id',
        drawCode: 'nacional-11am',
        page: 2,
        limit: 10,
        sortBy: 'number',
        sortDirection: 'asc',
      }),
    ).toEqual({
      number: '02',
      scope: 'SHIFT',
      shiftId: 'shift-id',
      date: undefined,
      drawCode: 'nacional-11am',
      createdByUserId: undefined,
      page: 2,
      limit: 10,
      sortBy: 'number',
      sortDirection: 'asc',
    });
  });

  it('maps delete route params into an application command', () => {
    expect(BlockedNumbersHttpMapper.toDeleteCommand('block-id')).toEqual({
      blockId: 'block-id',
    });
  });
});
