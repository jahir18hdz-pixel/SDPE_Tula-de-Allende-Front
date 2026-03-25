import React from "react";
import styles from "../styles/ExpedientDocuments.module.css";
import type {
  PaymentPolicyOption,
  PolicyFormState,
} from "../types/expedient.types";

type Props = {
  open: boolean;
  savingPolicy: boolean;
  loadingPolicies: boolean;
  paymentPolicies: PaymentPolicyOption[];
  policyForm: PolicyFormState;
  setPolicyForm: React.Dispatch<React.SetStateAction<PolicyFormState>>;
  policyNumber: string;
  onClose: () => void;
  onSave: () => void;
};

export default function PolicyPanel({
  open,
  savingPolicy,
  loadingPolicies,
  paymentPolicies,
  policyForm,
  setPolicyForm,
  policyNumber,
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
              {policyNumber?.trim() ? "Editar póliza" : "Agregar póliza"}
            </div>
            <div className={styles.uploadSheetNote}>
              Selecciona la póliza disponible que deseas asociar a esta
              solicitud
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onClose}
              disabled={savingPolicy}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          <div className={styles.policyFormWrap}>
            <div className={styles.managerSectionCard}>
              <div className={styles.editorSectionTitle}>
                Datos de la póliza
              </div>

              <div className={styles.editorFloatingSelectField}>
                <span className={styles.editorFloatingLabel}>Póliza</span>
                <select
                  className={styles.editorFloatingSelect}
                  value={policyForm.idPaymentPolicy ?? ""}
                  onChange={(e) =>
                    setPolicyForm({
                      idPaymentPolicy: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  disabled={savingPolicy || loadingPolicies}
                >
                  <option value="">
                    {loadingPolicies
                      ? "Cargando pólizas..."
                      : "Seleccionar póliza…"}
                  </option>

                  {paymentPolicies.map((p) => (
                    <option key={p.idPaymentPolicy} value={p.idPaymentPolicy}>
                      {p.policyCode}
                      {p.description ? ` — ${p.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {policyForm.idPaymentPolicy && (
                <div className={styles.policyPreviewCard}>
                  <div className={styles.policyPreviewCode}>
                    {paymentPolicies.find(
                      (x) => x.idPaymentPolicy === policyForm.idPaymentPolicy,
                    )?.policyCode ?? "Póliza seleccionada"}
                  </div>

                  <div className={styles.policyPreviewDesc}>
                    {paymentPolicies.find(
                      (x) => x.idPaymentPolicy === policyForm.idPaymentPolicy,
                    )?.description || "Sin descripción adicional."}
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
            disabled={savingPolicy}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={savingPolicy}
          >
            {savingPolicy ? "Guardando..." : "Guardar póliza"}
          </button>
        </div>
      </div>
    </div>
  );
}