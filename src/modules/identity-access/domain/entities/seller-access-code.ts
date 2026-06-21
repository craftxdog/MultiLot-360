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

export const SELLER_ACCESS_CODE_STATUSES = [
  'PENDIENTE',
  'USADO',
  'EXPIRADO',
  'REVOCADO',
] as const;

export type SellerAccessCodeStatus =
  (typeof SELLER_ACCESS_CODE_STATUSES)[number];

export type ListSellerInvitationsQuery = {
  email?: string;
  username?: string;
  sellerName?: string;
  status?: SellerAccessCodeStatus;
  page: number;
  limit: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
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
