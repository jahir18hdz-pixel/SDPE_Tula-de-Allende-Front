import React from "react";
import styles from "../styles/deleteDocument.module.css";
import type { PreviewItem } from "../types/expedient.types";

type Props = {
  open: boolean;
  deleteTarget: PreviewItem | null;
  deletePassword: string;
  setDeletePassword: React.Dispatch<React.SetStateAction<string>>;
  deletingPreview: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteDocumentModal({
  open,
  deleteTarget,
  deletePassword,
  setDeletePassword,
  deletingPreview,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !deleteTarget) return null;

  return (
    <div
      className={styles.deleteConfirmOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
      onClick={onClose}
    >
      <div
        className={styles.deleteConfirmModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.deleteConfirmHeader}>
         <div className={styles.deleteConfirmIcon}>×</div>

          <div className={styles.deleteConfirmHeaderText}>
            <div className={styles.deleteConfirmTitle}>
              Confirmar eliminación
            </div>
            <div className={styles.deleteConfirmSubtitle}>
              Esta acción eliminará el documento seleccionado.
            </div>
          </div>
        </div>

        <div className={styles.deleteConfirmBody}>
          <div className={styles.deleteFileCard}>
            <div className={styles.deleteFileLabel}>Documento</div>
            <div className={styles.deleteFileName} title={deleteTarget.name}>
              {deleteTarget.name}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Contraseña</label>
            <input
              type="password"
              className={styles.input}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              disabled={deletingPreview}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !deletingPreview) {
                  onConfirm();
                }
              }}
            />
          </div>

          <div className={styles.deleteWarningBox}>
            Esta acción no se puede deshacer.
          </div>
        </div>

        <div className={styles.deleteConfirmFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={deletingPreview}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.deleteConfirmBtn}
            onClick={onConfirm}
            disabled={deletingPreview || !deletePassword.trim()}
          >
            {deletingPreview ? "Eliminando..." : "Eliminar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}