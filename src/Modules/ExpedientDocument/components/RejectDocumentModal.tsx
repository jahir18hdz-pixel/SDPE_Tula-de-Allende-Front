import React from "react";
import styles from "../styles/ExpedientDocuments.module.css";
import type { PreviewItem } from "../types/expedient.types";

type Props = {
  open: boolean;
  currentPreview: PreviewItem | null;
  rejectObservations: string;
  setRejectObservations: React.Dispatch<React.SetStateAction<string>>;
  reviewingDocument: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RejectDocumentModal({
  open,
  currentPreview,
  rejectObservations,
  setRejectObservations,
  reviewingDocument,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !currentPreview || !currentPreview.id) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar denegación del documento"
      onClick={() => {
        if (reviewingDocument) return;
        onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 3000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 96vw)",
          background: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
          border: "1px solid rgba(239, 68, 68, 0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #fee2e2",
            background: "#fff7f7",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#991b1b" }}>
            Denegar documento
          </div>
          <div style={{ marginTop: "6px", color: "#7f1d1d", fontSize: "14px" }}>
            Confirma la denegación e indica las observaciones del documento.
          </div>
        </div>

        <div style={{ padding: "20px", display: "grid", gap: "14px" }}>
          <div
            style={{
              display: "grid",
              gap: "8px",
              padding: "14px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "13px", color: "#475569", fontWeight: 700 }}>
              Documento
            </div>
            <div style={{ fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
              {currentPreview.name}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Estado</label>
            <input
              type="text"
              className={styles.input}
              value="Denegado"
              disabled
              readOnly
            />
          </div>

          <div className={styles.formField}>
            <label
              htmlFor="txt-observaciones-denegacion-documento"
              className={styles.fieldLabel}
            >
              Observaciones
            </label>
            <textarea
              id="txt-observaciones-denegacion-documento"
              className={styles.checklistCompactTextarea}
              value={rejectObservations}
              onChange={(e) => setRejectObservations(e.target.value)}
              placeholder="Escribe la razón por la cual se deniega el documento"
              rows={6}
              disabled={reviewingDocument}
              autoFocus
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 20px 20px",
            borderTop: "1px solid #f1f5f9",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={reviewingDocument}
          >
            Cancelar
          </button>

          <button
            id="btn-confirmar-denegacion-documento"
            type="button"
            className={styles.dangerBtn}
            onClick={onConfirm}
            disabled={reviewingDocument || !rejectObservations.trim()}
          >
            {reviewingDocument ? "Procesando..." : "Confirmar denegación"}
          </button>
        </div>
      </div>
    </div>
  );
}