import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import styles from "../styles/NotificationsView.module.css";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { BASE_URL, readToken, requestJson } from "../../../services/api";

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
  title?: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
  requestId?: number | null;
};

type NotificationSignalRPayload = {
  id: number;
  title?: string;
  message: string;
  requestId?: number | null;
  createdAt: string;
};

type FilterType = "all" | "unread" | "read";

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
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

function buildNotificationTitle(item: {
  requestId?: number | null;
  message: string;
  title?: string;
}): string {
  if (item.title && item.title.trim()) return item.title.trim();
  if (item.requestId) return `Solicitud #${item.requestId}`;
  return "Notificación";
}

function sortNotifications(list: NotificationItem[]) {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export default function NotificationsView() {
  const navigate = useNavigate();
  const userId = getUserId();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const [markingAll, setMarkingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");
  const [showToast, setShowToast] = useState(false);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const showAppToast = useCallback((message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      showAppToast("No se pudo identificar el usuario actual.", "error");
      return;
    }

    try {
      setLoading(true);

      const response = await requestJson(`/api/notifications/all/${userId}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          response.error || "No se pudieron cargar las notificaciones.",
        );
      }

      const data = Array.isArray(response.data)
        ? (response.data as NotificationApiItem[])
        : [];

      const mapped: NotificationItem[] = data
        .map((item) => ({
          id: item.id ?? item.idNotification ?? 0,
          title: buildNotificationTitle({
            requestId: item.requestId ?? null,
            message: item.message,
            title: item.title,
          }),
          message: item.message,
          requestId: item.requestId ?? null,
          isRead: item.isRead ?? false,
          createdAt: item.createdAt,
        }))
        .filter((item) => item.id > 0);

      setNotifications(sortNotifications(mapped));
    } catch (error) {
      console.error(error);
      showAppToast("No se pudieron cargar las notificaciones.", "error");
    } finally {
      setLoading(false);
    }
  }, [showAppToast, userId]);

  const markAsRead = useCallback(
  async (notificationId: number) => {
    try {
      setProcessingId(notificationId);

      const response = await requestJson(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
        },
      );

      if (!response.ok) {
        throw new Error(
          response.error || "No se pudo marcar la notificación como leída.",
        );
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n,
        ),
      );
    } catch (error) {
      console.error(error);
      showAppToast("No se pudo marcar la notificación como leída.", "error");
    } finally {
      setProcessingId(null);
    }
  },
  [showAppToast],
);

  const markAllAsRead = useCallback(async () => {
    if (!userId) {
      showAppToast("No se pudo identificar el usuario actual.", "error");
      return;
    }

    try {
      setMarkingAll(true);

      const response = await requestJson(
        `/api/notifications/read-all/${userId}`,
        {
          method: "PUT",
        },
      );

      if (!response.ok) {
        throw new Error(
          response.error || "No se pudieron marcar todas como leídas.",
        );
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showAppToast(
        "Todas las notificaciones se marcaron como leídas.",
        "success",
      );
    } catch (error) {
      console.error(error);
      showAppToast("No se pudieron marcar todas como leídas.", "error");
    } finally {
      setMarkingAll(false);
    }
  }, [showAppToast, userId]);

  const deleteNotification = useCallback(
    async (notificationId: number) => {
      try {
        setProcessingId(notificationId);

        const response = await requestJson(
          `/api/notifications/${notificationId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          throw new Error(
            response.error || "No se pudo eliminar la notificación.",
          );
        }

        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        showAppToast("Notificación eliminada.", "success");
      } catch (error) {
        console.error(error);
        showAppToast("No se pudo eliminar la notificación.", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [showAppToast],
  );

  const deleteAllNotifications = useCallback(async () => {
    if (!userId) {
      showAppToast("No se pudo identificar el usuario actual.", "error");
      return;
    }

    try {
      setDeletingAll(true);

      const response = await requestJson(`/api/notifications/user/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          response.error || "No se pudieron eliminar las notificaciones.",
        );
      }

      setNotifications([]);
      setShowDeleteAllConfirm(false);
      showAppToast("Se eliminaron todas las notificaciones.", "success");
    } catch (error) {
      console.error(error);
      showAppToast(
        "No se pudieron eliminar todas las notificaciones.",
        "error",
      );
    } finally {
      setDeletingAll(false);
    }
  }, [showAppToast, userId]);

  const connectToHub = useCallback(async () => {
    try {
      if (connectionRef.current || !userId) return;

      const token = readToken();

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${BASE_URL}/notifications`, {
          accessTokenFactory: () => token ?? "",
        })
        .withAutomaticReconnect()
        .build();

      connection.on(
        "ReceiveNotification",
        (notification: NotificationSignalRPayload) => {
          const newNotification: NotificationItem = {
            id: notification.id,
            title: buildNotificationTitle({
              requestId: notification.requestId ?? null,
              message: notification.message,
              title: notification.title,
            }),
            message: notification.message,
            requestId: notification.requestId ?? null,
            isRead: false,
            createdAt: notification.createdAt,
          };

          setNotifications((prev) => {
            const exists = prev.some((x) => x.id === newNotification.id);
            if (exists) return prev;
            return sortNotifications([newNotification, ...prev]);
          });

          showAppToast("Nueva notificación recibida.", "success");
        },
      );

      await connection.start();

      connectionRef.current = connection;
    } catch (error) {
      console.error("Error conectando a SignalR:", error);
    }
  }, [showAppToast, userId]);

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

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const readCount = useMemo(
    () => notifications.filter((n) => n.isRead).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [filter, notifications]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      if (notification.requestId) {
        navigate(`/adquisiciones/${notification.requestId}/expediente`);
      }
    },
    [markAsRead, navigate],
  );

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, []);

  const getRelativeTime = useCallback((dateString: string) => {
    const now = new Date().getTime();
    const value = new Date(dateString).getTime();
    const diffMs = value - now;

    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

    const minutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
    return rtf.format(days, "day");
  }, []);

  return (
    <div className={styles.page}>
      <Toast
        open={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />

      <div className={styles.mainContent}>
        <section className={styles.hero}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Notificaciones</h1>
              <p className={styles.subtitle}>
                Consulta el historial, revisa alertas pendientes y accede rápido
                a las solicitudes relacionadas.
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
                className={styles.secondaryButton}
                onClick={fetchNotifications}
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Actualizar"}
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
        </section>

        <section className={styles.toolbar}>
          <div className={styles.filters}>
            <button
              type="button"
              className={`${styles.filterButton} ${
                filter === "all" ? styles.activeFilter : ""
              }`}
              onClick={() => setFilter("all")}
            >
              Todas
              <span className={styles.filterCount}>{notifications.length}</span>
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                filter === "unread" ? styles.activeFilter : ""
              }`}
              onClick={() => setFilter("unread")}
            >
              No leídas
              <span className={styles.filterCount}>{unreadCount}</span>
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                filter === "read" ? styles.activeFilter : ""
              }`}
              onClick={() => setFilter("read")}
            >
              Leídas
              <span className={styles.filterCount}>{readCount}</span>
            </button>
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={deletingAll || notifications.length === 0}
            >
              {deletingAll ? "Eliminando..." : "Eliminar todas"}
            </button>
          </div>
        </section>

        <section className={styles.content}>
          {loading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Cargando notificaciones...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>
                No hay notificaciones para mostrar
              </p>
              <p className={styles.emptyDescription}>
                Cuando tengas nuevas alertas aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className={styles.notificationList}>
              {filteredNotifications.map((notification) => {
                const isBusy = processingId === notification.id;

                return (
                  <article
                    key={notification.id}
                    className={`${styles.notificationCard} ${
                      !notification.isRead ? styles.unreadCard : ""
                    } ${notification.requestId ? styles.clickableCard : ""}`}
                    onClick={() =>
                      notification.requestId
                        ? handleNotificationClick(notification)
                        : undefined
                    }
                    role={notification.requestId ? "button" : undefined}
                    tabIndex={notification.requestId ? 0 : -1}
                    onKeyDown={(e) => {
                      if (
                        notification.requestId &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        void handleNotificationClick(notification);
                      }
                    }}
                  >
                    <div className={styles.notificationMain}>
                      <div className={styles.notificationTop}>
                        <div className={styles.notificationTitleRow}>
                          <h3 className={styles.notificationTitle}>
                            {notification.title}
                          </h3>

                          {!notification.isRead ? (
                            <span className={styles.statusChipUnread}>
                              Nueva
                            </span>
                          ) : (
                            <span className={styles.statusChipRead}>Leída</span>
                          )}
                        </div>
                      </div>

                      <p className={styles.notificationMessage}>
                        {notification.message}
                      </p>

                      <div className={styles.notificationMeta}>
                        <span className={styles.metaPill}>
                          {formatDate(notification.createdAt)}
                        </span>

                        <span className={styles.metaPillSoft}>
                          {getRelativeTime(notification.createdAt)}
                        </span>

                        {notification.requestId ? (
                          <span className={styles.metaPill}>
                            Solicitud #{notification.requestId}
                          </span>
                        ) : (
                          <span className={styles.metaPillSoft}>
                            Sin solicitud relacionada
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={styles.notificationActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!notification.isRead && (
                        <button
                          type="button"
                          className={styles.smallSecondaryButton}
                          onClick={() => void markAsRead(notification.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Procesando..." : "Marcar como leída"}
                        </button>
                      )}

                      {notification.requestId && (
                        <button
                          type="button"
                          className={styles.smallPrimaryButton}
                          onClick={() =>
                            void handleNotificationClick(notification)
                          }
                        >
                          Ver detalle
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.iconDangerButton}
                        onClick={() => void deleteNotification(notification.id)}
                        disabled={isBusy}
                        title="Eliminar notificación"
                        aria-label="Eliminar notificación"
                      >
                        ✕
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showDeleteAllConfirm && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de notificaciones"
          onClick={() => !deletingAll && setShowDeleteAllConfirm(false)}
        >
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmHeader}>
              <div className={styles.confirmHeaderIcon}>×</div>

              <div className={styles.confirmHeaderText}>
                <div id="delete-all-title" className={styles.confirmTitle}>
                  Eliminar todas las notificaciones
                </div>
                <div className={styles.confirmSubtitle}>
                  Esta acción eliminará todo el historial de notificaciones.
                </div>
              </div>
            </div>

            <div className={styles.confirmBody}>
              <div className={styles.confirmFileCard}>
                <div className={styles.confirmFileLabel}>Acción</div>
                <div className={styles.confirmFileName}>
                  Se eliminarán todas las notificaciones registradas.
                </div>
              </div>

              <div className={styles.confirmWarningBox}>
                Esta acción no se puede deshacer.
              </div>
            </div>

            <div className={styles.confirmFooter}>
              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={deletingAll}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => void deleteAllNotifications()}
                disabled={deletingAll}
              >
                {deletingAll ? "Eliminando..." : "Eliminar notificaciones"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
