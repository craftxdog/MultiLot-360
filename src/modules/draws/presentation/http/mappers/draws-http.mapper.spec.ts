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
      }),
    ).toEqual({
      date: '2026-06-21',
      status: 'ABIERTO',
    });
  });
});
