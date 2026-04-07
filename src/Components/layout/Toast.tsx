import React, { useEffect } from "react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error";

type ToastProps = {
  open: boolean;
  type: ToastType;
  message: string;
  title?: string;
  durationMs?: number; 
  onClose: () => void;
};

const Toast: React.FC<ToastProps> = ({
  open,
  type,
  message,
  title,
  durationMs = 3200,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  const computedTitle =
    title ?? (type === "success" ? "Éxito" : "Error");

  return (
    <div
      className={[
        styles.toast,
        open ? styles.toastOpen : "",
        type === "success" ? styles.toastSuccess : styles.toastError,
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className={styles.toastTitle}>{computedTitle}</div>
      <div className={styles.toastMsg}>{message}</div>

      <button
        type="button"
        className={styles.toastClose}
        onClick={onClose}
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
