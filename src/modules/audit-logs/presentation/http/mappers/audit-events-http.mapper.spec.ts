import { AuditEventsHttpMapper } from './audit-events-http.mapper';

describe('AuditEventsHttpMapper', () => {
  it('maps list query into a domain query', () => {
    expect(
      AuditEventsHttpMapper.toListQuery({
        userId: 'user-id',
        event: 'http.request.completed',
        createdFrom: '2026-06-22',
        createdUntil: '2026-06-23',
        page: 2,
        limit: 10,
        sortBy: 'event',
        sortDirection: 'asc',
      }),
    ).toEqual({
      userId: 'user-id',
      event: 'http.request.completed',
      createdFrom: '2026-06-22',
      createdUntil: '2026-06-23',
      page: 2,
      limit: 10,
      sortBy: 'event',
      sortDirection: 'asc',
    });
  });
});
