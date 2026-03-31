import React from "react";
import styles from "../styles/cfdi.module.css";
import type { CfdiFormState } from "../types/expedient.types";

type Props = {
  open: boolean;
  savingCfdi: boolean;
  cfdi: string;
  cfdiForm: CfdiFormState;
  setCfdiForm: React.Dispatch<React.SetStateAction<CfdiFormState>>;
  onClose: () => void;
  onSave: () => void;
};

export default function CfdiPanel({
  open,
  savingCfdi,
  cfdi,
  cfdiForm,
  setCfdiForm,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div
      className={`${styles.uploadOverlay} ${
        open ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
      }`}
      aria-hidden={!open}
    >
      <div className={styles.uploadSheet}>
        <div className={styles.uploadSheetHeader}>
          <div className={styles.uploadSheetTitleWrap}>
            <div className={styles.uploadHandle} />
            <div className={styles.uploadSheetTitle}>
              {cfdi?.trim() ? "Editar CFDI" : "Agregar CFDI"}
            </div>
            <div className={styles.uploadSheetNote}>
              Captura el folio o valor del CFDI para asociarlo a esta solicitud
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onClose}
              disabled={savingCfdi}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          <div className={styles.policyFormWrap}>
            <div className={styles.managerSectionCard}>
              <div className={styles.editorSectionTitle}>Datos del CFDI</div>

              <div className={styles.editorFloatingField}>
                <span className={styles.editorFloatingLabel}>CFDI</span>
                <input
                  className={styles.editorFloatingInput}
                  value={cfdiForm.cfdi}
                  onChange={(e) =>
                    setCfdiForm({
                      cfdi: e.target.value,
                    })
                  }
                  placeholder="Captura el CFDI…"
                  disabled={savingCfdi}
                />
              </div>

              {cfdiForm.cfdi.trim() && (
                <div className={styles.cfdiPreviewCard}>
                  <div className={styles.cfdiPreviewCode}>
                    {cfdiForm.cfdi.trim()}
                  </div>
                  <div className={styles.cfdiPreviewDesc}>
                    CFDI que se asociará a esta solicitud.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.uploadSheetFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={savingCfdi}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={savingCfdi}
          >
            {savingCfdi ? "Guardando..." : "Guardar CFDI"}
          </button>
        </div>
      </div>
    </div>
  );
}