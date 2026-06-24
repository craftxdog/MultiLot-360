import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { AuditEvent, AuditEventPayload } from '../entities';

export const AUDIT_EVENTS_REPOSITORY = Symbol('AUDIT_EVENTS_REPOSITORY');

export type RecordAuditEventInput = {
  userId?: string;
  event: string;
  payload?: AuditEventPayload;
};

export type ListAuditEventsQuery = OffsetPaginationQuery & {
  userId?: string;
  event?: string;
  createdFrom?: string;
  createdUntil?: string;
};

export interface AuditEventsRepository {
  record(input: RecordAuditEventInput): Promise<AuditEvent>;
  findById(eventId: string): Promise<AuditEvent | null>;
  list(query: ListAuditEventsQuery): Promise<PaginatedResult<AuditEvent>>;
}
