import { SystemParametersHttpMapper } from './system-parameters-http.mapper';

describe('SystemParametersHttpMapper', () => {
  it('maps list query into a domain query', () => {
    expect(
      SystemParametersHttpMapper.toListQuery({
        key: 'sales.',
        page: 2,
        limit: 10,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }),
    ).toEqual({
      key: 'sales.',
      page: 2,
      limit: 10,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });

  it('maps upsert dto into an application command', () => {
    expect(
      SystemParametersHttpMapper.toUpsertCommand('sales.void_window_minutes', {
        value: '10',
      }),
    ).toEqual({
      key: 'sales.void_window_minutes',
      value: '10',
    });
  });
});
