const STORAGE_PREFIX = 'aptos_dapp_';

export const storage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  },
};
