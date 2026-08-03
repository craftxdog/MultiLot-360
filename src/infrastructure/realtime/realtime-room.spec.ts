import { realtimeRoom, toAudienceRooms } from './realtime-room';

describe('Realtime rooms', () => {
  it('normalizes authorization rooms and removes duplicates', () => {
    expect(
      toAudienceRooms({
        tenantId: 'tenant-id',
        modules: ['Ventas', 'ventas'],
        roles: ['ADMIN'],
        sellerIds: ['seller-id'],
        userIds: ['user-id'],
      }),
    ).toEqual([
      'tenant:tenant-id:module:ventas',
      'tenant:tenant-id:role:admin',
      'tenant:tenant-id:seller:seller-id',
      'tenant:tenant-id:user:user-id',
    ]);
  });

  it('builds stable room names', () => {
    expect(realtimeRoom.module('tenant-id', 'Limites_Numero')).toBe(
      'tenant:tenant-id:module:limites_numero',
    );
    expect(realtimeRoom.role('tenant-id', 'VENDEDOR')).toBe(
      'tenant:tenant-id:role:vendedor',
    );
  });
});
