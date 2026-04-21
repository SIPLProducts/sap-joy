const CURRENT_SESSION_KEY = 'mrb_active_session';

const isAuthStorageKey = (key: string) =>
  key.includes('supabase') ||
  key.includes('sb-') ||
  key.includes('auth-token') ||
  key === CURRENT_SESSION_KEY;

export const hasCurrentBrowserSession = () =>
  sessionStorage.getItem(CURRENT_SESSION_KEY) === 'true';

export const markCurrentBrowserSession = () => {
  sessionStorage.setItem(CURRENT_SESSION_KEY, 'true');
};

export const clearAuthStorage = () => {
  Object.keys(localStorage)
    .filter(isAuthStorageKey)
    .forEach((key) => localStorage.removeItem(key));

  Object.keys(sessionStorage)
    .filter(isAuthStorageKey)
    .forEach((key) => sessionStorage.removeItem(key));
};