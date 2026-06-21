export const MAILER_PORT = Symbol('MAILER_PORT');

export type MailRecipient = {
  email: string;
  name?: string;
};

export type SendSellerInvitationInput = {
  recipient: MailRecipient;
  adminName: string;
  sellerName: string;
  accessCode: string;
  expiresInMinutes: number;
};

export type SendSellerAccessCodeInput = {
  recipient: MailRecipient;
  sellerName: string;
  accessCode: string;
  expiresInMinutes: number;
};

export type SendAccountConfirmationInput = {
  recipient: MailRecipient;
  userName: string;
  confirmationCode: string;
  expiresInMinutes: number;
};

export interface MailerPort {
  sendSellerInvitation(input: SendSellerInvitationInput): Promise<void>;
  sendSellerAccessCode(input: SendSellerAccessCodeInput): Promise<void>;
  sendAccountConfirmation(input: SendAccountConfirmationInput): Promise<void>;
}
