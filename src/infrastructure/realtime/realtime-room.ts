import { IntegrationEventAudience } from '../../shared-kernel';

export const realtimeRoom = {
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  module: (tenantId: string, moduleCode: string) =>
    `tenant:${tenantId}:module:${normalize(moduleCode)}`,
  role: (tenantId: string, roleName: string) =>
    `tenant:${tenantId}:role:${normalize(roleName)}`,
  seller: (tenantId: string, sellerId: string) =>
    `tenant:${tenantId}:seller:${sellerId}`,
  user: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:${userId}`,
};

export const toAudienceRooms = (
  audience: IntegrationEventAudience,
): string[] => {
  if (!audience.tenantId) return [];
  const tenantId = audience.tenantId;
  return unique([
    ...(audience.modules ?? []).map((value) =>
      realtimeRoom.module(tenantId, value),
    ),
    ...(audience.roles ?? []).map((value) =>
      realtimeRoom.role(tenantId, value),
    ),
    ...(audience.sellerIds ?? []).map((value) =>
      realtimeRoom.seller(tenantId, value),
    ),
    ...(audience.userIds ?? []).map((value) =>
      realtimeRoom.user(tenantId, value),
    ),
  ]);
};

const normalize = (value: string): string => value.trim().toLowerCase();

const unique = (values: string[]): string[] => [...new Set(values)];
