export type AuditEventActor = {
  id: string;
  username: string;
  name: string | null;
};

export type AuditEventPayload =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export type AuditEvent = {
  id: string;
  userId: string | null;
  event: string;
  payload: AuditEventPayload;
  actor: AuditEventActor | null;
  createdAt: Date;
};
