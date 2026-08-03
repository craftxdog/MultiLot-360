export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';
export const MODULES_KEY = 'modules';
export const BILLING_AUTH_MODE_KEY = 'billingAuthMode';
export type BillingAuthMode = 'portal' | 'platform';

export const SYSTEM_MODULES = {
  usuarios: 'usuarios',
  roles: 'roles',
  vendedores: 'vendedores',
  sorteos: 'sorteos',
  turnos: 'turnos',
  ventas: 'ventas',
  salesMatrix: 'matriz_ventas',
  resultados: 'resultados',
  pagosPremios: 'pagos_premios',
  numerosBloqueados: 'numeros_bloqueados',
  limitesNumero: 'limites_numero',
  cortes: 'cortes',
  parametros: 'parametros',
  auditoria: 'auditoria',
  notificaciones: 'notificaciones',
} as const;

export type SystemModule = (typeof SYSTEM_MODULES)[keyof typeof SYSTEM_MODULES];
export type ModuleKey = SystemModule | (string & { readonly __module?: never });
export type RoleKey = string & { readonly __role?: never };
export type PermissionKey = string & { readonly __permission?: never };
