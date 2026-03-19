import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import styles from "../styles/NotificationsView.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { authHeaders } from "../../../services/api";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  requestId?: number | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationApiItem = {
  id?: number;
  idNotification?: number;
  title: string;
  message: string;
  requestId?: number | null;
  isRead?: boolean;
  read?: boolean;
  createdAt: string;
};

type NotificationSignalRPayload = {
  id: number;
  title: string;
  message: string;
  requestId?: number | null;
  createdAt: string;
};

type FilterType = "all" | "unread" | "read";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function NotificationsView() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [filter, setFilter] = useState<FilterType>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");
  const [showToast, setShowToast] = useState(false);

  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const showAppToast = useCallback((message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/notifications`, {
        method: "GET",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las notificaciones.");
      }

      const data: NotificationApiItem[] = await response.json();

      const mapped: NotificationItem[] = (Array.isArray(data) ? data : []).map(
        (item) => ({
          id: item.id ?? item.idNotification ?? 0,
          title: item.title,
          message: item.message,
          requestId: item.requestId ?? null,
          isRead: item.isRead ?? item.read ?? false,
          createdAt: item.createdAt,
        })
      );

      mapped.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(mapped);
    } catch (error) {
      console.error(error);
      showAppToast("No se pudieron cargar las notificaciones.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAppToast]);

  const markAsRead = useCallback(
    async (notificationId: number) => {
      try {
        const response = await fetch(
          `${API_BASE}/api/notifications/${notificationId}/read`,
          {
            method: "PUT",
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("No se pudo marcar la notificación como leída.");
        }

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error(error);
        showAppToast("No se pudo marcar la notificación como leída.", "error");
      }
    },
    [showAppToast]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      setMarkingAll(true);

      const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("No se pudieron marcar todas como leídas.");
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showAppToast("Todas las notificaciones se marcaron como leídas.", "success");
    } catch (error) {
      console.error(error);
      showAppToast("No se pudieron marcar todas como leídas.", "error");
    } finally {
      setMarkingAll(false);
    }
  }, [showAppToast]);

  const connectToHub = useCallback(async () => {
    try {
      if (connectionRef.current) return;

      setConnectionState("connecting");

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        "";

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE}/hubs/notifications`, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect()
        .build();

      connection.on(
        "ReceiveNotification",
        (notification: NotificationSignalRPayload) => {
          const newNotification: NotificationItem = {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            requestId: notification.requestId ?? null,
            isRead: false,
            createdAt: notification.createdAt,
          };

          setNotifications((prev) => {
            const exists = prev.some((x) => x.id === newNotification.id);
            if (exists) return prev;

            return [newNotification, ...prev].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });

          showAppToast("Nueva notificación recibida.", "success");
        }
      );

      connection.onreconnecting(() => {
        setConnectionState("connecting");
      });

      connection.onreconnected(() => {
        setConnectionState("connected");
      });

      connection.onclose(() => {
        setConnectionState("disconnected");
      });

      await connection.start();

      connectionRef.current = connection;
      setConnectionState("connected");
    } catch (error) {
      console.error("Error conectando a SignalR:", error);
      setConnectionState("disconnected");
    }
  }, [showAppToast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    connectToHub();

    return () => {
      const connection = connectionRef.current;
      connectionRef.current = null;

      if (connection) {
        connection.stop().catch(() => undefined);
      }
    };
  }, [connectToHub]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [filter, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      if (notification.requestId) {
        navigate(`/adquisiciones/${notification.requestId}`);
      }
    },
    [markAsRead, navigate]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notificaciones</h1>
          <p className={styles.subtitle}>
            Aquí puedes ver las notificaciones recientes, el historial y su estado.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate(-1)}
          >
            Volver
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={markAllAsRead}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? "Marcando..." : "Marcar todas como leídas"}
          </button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total</span>
          <strong className={styles.summaryValue}>{notifications.length}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>No leídas</span>
          <strong className={styles.summaryValue}>{unreadCount}</strong>
        </div>

        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Conexión en tiempo real</span>
          <strong
            className={`${styles.connectionBadge} ${
              connectionState === "connected"
                ? styles.connected
                : connectionState === "connecting"
                ? styles.connecting
                : styles.disconnected
            }`}
          >
            {connectionState === "connected"
              ? "Conectado"
              : connectionState === "connecting"
              ? "Conectando..."
              : "Desconectado"}
          </strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterButton} ${
              filter === "all" ? styles.activeFilter : ""
            }`}
            onClick={() => setFilter("all")}
          >
            Todas
          </button>

          <button
            type="button"
            className={`${styles.filterButton} ${
              filter === "unread" ? styles.activeFilter : ""
            }`}
            onClick={() => setFilter("unread")}
          >
            No leídas
          </button>

          <button
            type="button"
            className={`${styles.filterButton} ${
              filter === "read" ? styles.activeFilter : ""
            }`}
            onClick={() => setFilter("read")}
          >
            Leídas
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.emptyState}>Cargando notificaciones...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            No hay notificaciones para mostrar.
          </div>
        ) : (
          <div className={styles.notificationList}>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.notificationCard} ${
                  !notification.isRead ? styles.unreadCard : ""
                }`}
              >
                <div className={styles.notificationMain}>
                  <div className={styles.notificationTop}>
                    <h3 className={styles.notificationTitle}>
                      {notification.title}
                    </h3>
                    {!notification.isRead && <span className={styles.unreadDot} />}
                  </div>

                  <p className={styles.notificationMessage}>
                    {notification.message}
                  </p>

                  <div className={styles.notificationMeta}>
                    <span>{formatDate(notification.createdAt)}</span>
                    {notification.requestId ? (
                      <span>Solicitud #{notification.requestId}</span>
                    ) : (
                      <span>Sin solicitud relacionada</span>
                    )}
                  </div>
                </div>

                <div className={styles.notificationActions}>
                  {!notification.isRead && (
                    <button
                      type="button"
                      className={styles.smallSecondaryButton}
                      onClick={() => markAsRead(notification.id)}
                    >
                      Marcar como leída
                    </button>
                  )}

                  {notification.requestId && (
                    <button
                      type="button"
                      className={styles.smallPrimaryButton}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      Ver detalle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast
        open={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
