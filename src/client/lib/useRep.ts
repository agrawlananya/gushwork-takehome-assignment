import { REPS } from "@shared/constants";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { storage } from "./storage";

const KEY = "rep";
const isRep = (id: string | null): id is string => id !== null && REPS.some((r) => r.id === id);

/**
 * The rep being viewed (PRD T-5, A1–A2). `?rep=` in the URL wins, then the choice remembered
 * on this device. null = "All reps" (the default on a first visit).
 */
export function useRep(): [string | null, (rep: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(KEY);
  const rep = isRep(fromUrl) ? fromUrl : fromUrl === "all" ? null : (() => {
    const saved = storage.local.get(KEY);
    return isRep(saved) ? saved : null;
  })();

  const setRep = useCallback(
    (next: string | null) => {
      storage.local.set(KEY, next);
      setParams(
        (p) => {
          const copy = new URLSearchParams(p);
          copy.set(KEY, next ?? "all");
          return copy;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [rep, setRep];
}

export function repLabel(rep: string | null): string {
  return REPS.find((r) => r.id === rep)?.name ?? "All reps";
}
