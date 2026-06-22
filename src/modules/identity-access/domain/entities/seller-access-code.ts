export const SELLER_ACCESS_CODE_STATUSES = [
  'PENDIENTE',
  'USADO',
  'EXPIRADO',
  'REVOCADO',
] as const;

export type SellerAccessCodeStatus =
  (typeof SELLER_ACCESS_CODE_STATUSES)[number];

export type SellerInvitation = {
  userId: string;
  sellerId: string;
  email: string;
  sellerName: string;
  expiresAt: Date;
};

export type RevokedSellerInvitation = {
  id: string;
  userId: string;
  sellerId: string;
  email: string;
  sellerName: string;
  status: 'REVOCADO';
};

export type ConfirmedSellerAccess = {
  userId: string;
  sellerId: string;
  email: string;
};

export type SellerInvitationListItem = {
  id: string;
  userId: string;
  sellerId: string;
  email: string;
  username: string;
  sellerName: string;
  documentId: string;
  status: SellerAccessCodeStatus;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
    name: string | null;
  } | null;
};
