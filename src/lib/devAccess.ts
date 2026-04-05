const DEV_USERS = [
  'support@cabino.ai',
  'cabinoai@gmail.com',
];

export const hasDevAccess = (email: string | null | undefined): boolean => {
  if (import.meta.env.DEV) return true;
  return !!email && DEV_USERS.includes(email);
};
