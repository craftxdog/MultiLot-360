export const parseCorsOrigins = (
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): boolean | string[] => {
  if (!value) {
    return nodeEnv === 'production' ? false : true;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : nodeEnv === 'production' ? false : true;
};
