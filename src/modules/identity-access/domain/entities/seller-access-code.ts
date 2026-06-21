export type CreateSellerInvitationCommand = {
  email: string;
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
  authUserId: string;
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
