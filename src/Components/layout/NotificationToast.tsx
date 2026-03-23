import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./NotificationToast.module.css";

type NotificationToastProps = {
  open: boolean;
  message: string;
  title?: string;
  durationMs?: number;
  onClose: () => void;
  onView?: () => void;
};

const NotificationToast: React.FC<NotificationToastProps> = ({
  open,
  message,
  title,
  durationMs = 4500,
  onClose,
  onView,
}) => {
  useEffect(() => {
    if (!open) return;

    const t = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite">
      <div className={styles.icon}>🔔</div>

      <div className={styles.content}>
        <div className={styles.toastTitle}>
          {title ?? "Nueva notificación"}
        </div>

        <div className={styles.toastMsg}>{message}</div>

        {onView && (
          <button
            type="button"
            className={styles.toastAction}
            onClick={onView}
          >
            Ver detalle
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.toastClose}
        onClick={onClose}
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>,
    document.body,
  );
};

export default NotificationToast;