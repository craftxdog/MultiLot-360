export const MAILER_PORT = Symbol('MAILER_PORT');

export type MailDeliveryFailureReason =
  | 'AUTHENTICATION'
  | 'CONFIGURATION'
  | 'REJECTED'
  | 'UNAVAILABLE';

export class MailDeliveryError extends Error {
  override readonly name = 'MailDeliveryError';

  constructor(
    message: string,
    readonly reason: MailDeliveryFailureReason,
    readonly retryable: boolean,
    readonly originalError?: Error,
  ) {
    super(message);
  }
}

export type MailRecipient = {
  email: string;
  name?: string;
};

export type SendSellerInvitationInput = {
  recipient: MailRecipient;
  adminName: string;
  sellerName: string;
  accessCode: string;
  actionToken: string;
  expiresInMinutes: number;
};

export type SendSellerAccessCodeInput = {
  recipient: MailRecipient;
  sellerName: string;
  accessCode: string;
  actionToken: string;
  expiresInMinutes: number;
};

export type SendAccountConfirmationInput = {
  recipient: MailRecipient;
  userName: string;
  confirmationCode: string;
  expiresInMinutes: number;
};

export type SendPasswordRecoveryCodeInput = {
  recipient: MailRecipient;
  userName: string;
  recoveryCode: string;
  recoveryTokenHash: string;
  expiresInMinutes: number;
};

export interface MailerPort {
  sendSellerInvitation(input: SendSellerInvitationInput): Promise<void>;
  sendSellerAccessCode(input: SendSellerAccessCodeInput): Promise<void>;
  sendAccountConfirmation(input: SendAccountConfirmationInput): Promise<void>;
  sendPasswordRecoveryCode(input: SendPasswordRecoveryCodeInput): Promise<void>;
}
