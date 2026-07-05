import { realtimeRoom, toAudienceRooms } from './realtime-room';

describe('Realtime rooms', () => {
  it('normalizes authorization rooms and removes duplicates', () => {
    expect(
      toAudienceRooms({
        modules: ['Ventas', 'ventas'],
        roles: ['ADMIN'],
        sellerIds: ['seller-id'],
        userIds: ['user-id'],
      }),
    ).toEqual([
      'module:ventas',
      'role:admin',
      'seller:seller-id',
      'user:user-id',
    ]);
  });

  it('builds stable room names', () => {
    expect(realtimeRoom.module('Limites_Numero')).toBe('module:limites_numero');
    expect(realtimeRoom.role('VENDEDOR')).toBe('role:vendedor');
  });
});
