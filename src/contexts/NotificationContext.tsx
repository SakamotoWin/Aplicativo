import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, isAdmin, getToken } from "@/lib/api";

export type NotifType = "machine_offline" | "machine_online" | "new_payment" | "warning" | "info";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  maquinaId?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const STORAGE_KEY = "pix_machine_notifications";
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

interface MachineItem {
  id: string;
  nome?: string;
  ultimaRequisicao?: string | null;
  ultimoPagamentoRecebido?: string | null;
}

interface ClienteItem {
  id: string;
  nome: string;
  Maquina: MachineItem[];
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadFromStorage);
  const machineStatusRef = useRef<Map<string, boolean>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const newNotif: AppNotification = {
      ...n,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
  }, []);

  const checkMachines = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      let machines: MachineItem[] = [];
      if (isAdmin()) {
        const clientes = await apiFetch<ClienteItem[]>("/clientes");
        machines = Array.isArray(clientes) ? clientes.flatMap((c) => c.Maquina || []) : [];
      } else {
        // O servidor usa /maquina no singular
        const list = await apiFetch<MachineItem[]>("/maquina");
        machines = Array.isArray(list) ? list : [];
      }
      for (const m of machines) {
        const lastActivity = m.ultimaRequisicao || m.ultimoPagamentoRecebido;
        const isOnline = lastActivity
          ? Date.now() - new Date(lastActivity).getTime() < 5 * 60 * 1000
          : false;
        const prevOnline = machineStatusRef.current.get(m.id);
        if (prevOnline !== undefined) {
          if (prevOnline && !isOnline) {
            addNotification({
              type: "machine_offline",
              title: "Máquina Offline",
              message: `${m.nome || m.id} ficou offline`,
              maquinaId: m.id,
            });
          } else if (!prevOnline && isOnline) {
            addNotification({
              type: "machine_online",
              title: "Máquina Online",
              message: `${m.nome || m.id} voltou online`,
              maquinaId: m.id,
            });
          }
        }
        machineStatusRef.current.set(m.id, isOnline);
      }
    } catch {
      // silently ignore polling errors
    }
  }, [addNotification]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const timeout = setTimeout(() => {
      void checkMachines();
      intervalRef.current = setInterval(checkMachines, 30_000);
    }, 5000);
    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkMachines]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllRead, dismissNotification, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
