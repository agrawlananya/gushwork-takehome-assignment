export type Health = { ok: boolean; todayIST: string };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<Health>("/api/health"),
};
