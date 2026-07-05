import { IntegrationEventAudience } from '../../shared-kernel';

export const realtimeRoom = {
  module: (moduleCode: string) => `module:${normalize(moduleCode)}`,
  role: (roleName: string) => `role:${normalize(roleName)}`,
  seller: (sellerId: string) => `seller:${sellerId}`,
  user: (userId: string) => `user:${userId}`,
};

export const toAudienceRooms = (audience: IntegrationEventAudience): string[] =>
  unique([
    ...(audience.modules ?? []).map(realtimeRoom.module),
    ...(audience.roles ?? []).map(realtimeRoom.role),
    ...(audience.sellerIds ?? []).map(realtimeRoom.seller),
    ...(audience.userIds ?? []).map(realtimeRoom.user),
  ]);

const normalize = (value: string): string => value.trim().toLowerCase();

const unique = (values: string[]): string[] => [...new Set(values)];
