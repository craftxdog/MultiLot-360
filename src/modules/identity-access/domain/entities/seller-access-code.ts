export type CreateSellerInvitationCommand = {
  email: string;
  username: string;
  sellerName: string;
  documentId: string;
  phone?: string;
  address?: string;
  roleName?: string;
  adminUserId?: string;
  adminName: string;
};

export type ConfirmSellerAccessCodeCommand = {
  email: string;
  accessCode: string;
  password: string;
};

export type ResendSellerAccessCodeCommand = {
  email: string;
  adminUserId?: string;
};

export type SellerInvitation = {
  userId: string;
  sellerId: string;
  email: string;
  sellerName: string;
  expiresAt: Date;
};

export type ConfirmedSellerAccess = {
  userId: string;
  sellerId: string;
  email: string;
};
