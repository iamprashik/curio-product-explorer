import { useCallback, useEffect, useState } from "react";
import {
  ORDERS_KEY,
  readOrders,
  saveOrder,
  type DemoOrder,
} from "../lib/orders";

export function useOrders() {
  const [state, setState] = useState(readOrders);
  const reload = useCallback(() => setState(readOrders()), []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === ORDERS_KEY || event.key === null) reload();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [reload]);
  const add = useCallback((order: DemoOrder) => {
    const orders = saveOrder(order);
    setState({ orders, error: "" });
    return order;
  }, []);
  return { ...state, add, reload };
}
