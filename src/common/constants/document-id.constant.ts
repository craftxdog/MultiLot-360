export const NICARAGUA_DOCUMENT_ID_PATTERN = /^\d{3}-\d{6}-\d{4}[A-Z]$/i;

export const DOCUMENT_ID_FORMAT_MESSAGE =
  'El numero de documento debe tener formato 000-000000-0000A.';

export const DOCUMENT_ID_REQUIRED_MESSAGE =
  'El numero de documento es requerido.';

export const PHONE_NUMBER_PATTERN = /^(?:\+505)?\d{8}$/;

export const PHONE_NUMBER_FORMAT_MESSAGE =
  'El telefono debe tener 8 digitos o incluir el codigo +505.';

export const MODULE_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

export const USERNAME_FORMAT_MESSAGE =
  'El username debe tener 3 a 50 caracteres en minusculas y solo puede incluir letras, numeros, punto, guion o guion bajo.';

export const normalizeDocumentId = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  const normalizedValue = value
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .toUpperCase();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

export const normalizePhoneNumber = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  const normalizedValue = value.trim().replace(/[\s().\-\u2010-\u2015]/g, '');

  if (/^505\d{8}$/.test(normalizedValue)) return `+${normalizedValue}`;

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

export const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimUppercaseString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const trimLowercaseString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
