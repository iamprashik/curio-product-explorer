import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CartItem } from "../types";

export const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((v) => typeof v === "string") &&
  new Set(value).size === value.length;
export const isCart = (value: unknown): value is CartItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item.productId === "string" &&
      (item.variantId === undefined || typeof item.variantId === "string") &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 99,
  ) &&
  new Set(
    value.map((item) => `${item.productId}:${item.variantId ?? "default"}`),
  ).size === value.length;

export function useStoredState<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      return valid(data) ? data : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Usable in private browsers with storage disabled. */
    }
  }, [key, value]);
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== key) return;
      try {
        const data: unknown = JSON.parse(event.newValue ?? "null");
        setValue(valid(data) ? data : fallback);
      } catch {
        setValue(fallback);
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, valid, fallback]);
  return [value, setValue];
}
