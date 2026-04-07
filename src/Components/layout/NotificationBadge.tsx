import { useEffect, useMemo, useState } from "react";
import { requestJson, readToken } from "../../services/api";
import styles from "./NotificationBadge.module.css";

type NotificationApiItem = {
  id?: number;
  idNotification?: number;
  isRead?: boolean | string | number;
  IsRead?: boolean | string | number;
  leida?: boolean | string | number;
  Leida?: boolean | string | number;
  read?: boolean | string | number;
  Read?: boolean | string | number;
  message?: string;
  createdAt?: string;
  requestId?: number | null;
  title?: string;
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getUserId(): number | null {
  const token = readToken();
  if (!token) return null;

  const payload = parseJwtPayload(token);
  if (!payload) return null;

  const possibleKeys = [
    "userId",
    "userid",
    "idUsuario",
    "IdUsuario",
    "nameid",
    "sub",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  ];

  for (const key of possibleKeys) {
    const value = payload[key];

    if (typeof value === "number") return value;

    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
}

function getIsRead(item: NotificationApiItem): boolean {
  const value: unknown =
    item.isRead ??
    item.IsRead ??
    item.leida ??
    item.Leida ??
    item.read ??
    item.Read;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "si" ||
      normalized === "sí" ||
      normalized === "leida" ||
      normalized === "leída" ||
      normalized === "leido" ||
      normalized === "leído" ||
      normalized === "read"
    ) {
      return true;
    }

    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "no leida" ||
      normalized === "no leída" ||
      normalized === "unread"
    ) {
      return false;
    }
  }

  return false;
}

type NotificationBadgeProps = {
  collapsed?: boolean;
};

export default function NotificationBadge({
  collapsed = false,
}: NotificationBadgeProps) {
  const [count, setCount] = useState(0);

  const userId = useMemo(() => getUserId(), []);

  useEffect(() => {
    let alive = true;

    const loadUnreadCount = async () => {
      if (!userId) {
        if (alive) setCount(0);
        return;
      }

      try {
        const response = await requestJson(`/api/notifications/all/${userId}`, {
          method: "GET",
        });

        if (!alive) return;

        if (!response.ok) {
          setCount(0);
          return;
        }

        const data = Array.isArray(response.data)
          ? (response.data as NotificationApiItem[])
          : [];

        const unread = data.filter((item) => !getIsRead(item)).length;
        setCount(unread);
      } catch {
        if (alive) setCount(0);
      }
    };

    const timeoutId = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => {
      alive = false;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [userId]);

  if (count <= 0) return null;

  return (
    <span
      className={`${styles.badge} ${collapsed ? styles.badgeCollapsed : ""}`}
      title={`${count} notificaciones no leídas`}
      aria-label={`${count} notificaciones no leídas`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}