import React, { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";
import { FiAlertTriangle } from "react-icons/fi";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = "Confirmar acción",
  message,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  // Focus al abrir
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.modal}
        aria-label={title}
      >
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.iconWrap} aria-hidden="true">
            <FiAlertTriangle />
          </div>

          <div className={styles.headerText}>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.subtitle}>
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
        </div>

        {/* ACTIONS */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={styles.btnDanger}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Eliminando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
