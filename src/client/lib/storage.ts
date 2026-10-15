// localStorage / sessionStorage can be missing or throw (private mode, blocked storage).
// Every read and write goes through here so the app still works without them.

function wrap(get: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return get().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string | null): void {
      try {
        if (value === null) get().removeItem(key);
        else get().setItem(key, value);
      } catch {
        // Storage blocked: the choice just isn't remembered.
      }
    },
  };
}

export const storage = {
  local: wrap(() => window.localStorage),
  session: wrap(() => window.sessionStorage),
};
