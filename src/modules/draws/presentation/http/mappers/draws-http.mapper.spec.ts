import { DrawsHttpMapper } from './draws-http.mapper';

describe('DrawsHttpMapper', () => {
  it('maps create configuration dto into an application command', () => {
    expect(
      DrawsHttpMapper.toCreateConfigurationCommand({
        code: 'nacional-11am',
        time: '11:00:00',
        tuesdayOnly: false,
      }),
    ).toEqual({
      code: 'nacional-11am',
      time: '11:00:00',
      tuesdayOnly: false,
      lockSecondsBefore: undefined,
      reopenSecondsAfter: undefined,
      active: undefined,
    });
  });

  it('maps shift filters into an application query', () => {
    expect(
      DrawsHttpMapper.toListShiftsQuery({
        date: '2026-06-21',
        status: 'ABIERTO',
        page: 2,
        limit: 10,
        sortBy: 'configurationTime',
        sortDirection: 'asc',
      }),
    ).toEqual({
      date: '2026-06-21',
      status: 'ABIERTO',
      page: 2,
      limit: 10,
      sortBy: 'configurationTime',
      sortDirection: 'asc',
    });
  });

  it('maps update configuration dto into an application command', () => {
    expect(
      DrawsHttpMapper.toUpdateConfigurationCommand('configuration-id', {
        code: 'nacional-12pm',
        active: false,
      }),
    ).toEqual({
      configurationId: 'configuration-id',
      code: 'nacional-12pm',
      time: undefined,
      tuesdayOnly: undefined,
      lockSecondsBefore: undefined,
      reopenSecondsAfter: undefined,
      active: false,
    });
  });

  it('maps active shift filters into an application query', () => {
    expect(
      DrawsHttpMapper.toListActiveShiftsQuery({
        date: '2026-06-21',
        page: 1,
        limit: 25,
        sortBy: 'date',
        sortDirection: 'desc',
      }),
    ).toEqual({
      date: '2026-06-21',
      page: 1,
      limit: 25,
      sortBy: 'date',
      sortDirection: 'desc',
    });
  });

  it('maps configuration filters with pagination into an application query', () => {
    expect(
      DrawsHttpMapper.toListConfigurationsQuery({
        active: true,
        page: 3,
        limit: 5,
        sortBy: 'time',
        sortDirection: 'asc',
      }),
    ).toEqual({
      active: true,
      page: 3,
      limit: 5,
      sortBy: 'time',
      sortDirection: 'asc',
    });
  });
});
