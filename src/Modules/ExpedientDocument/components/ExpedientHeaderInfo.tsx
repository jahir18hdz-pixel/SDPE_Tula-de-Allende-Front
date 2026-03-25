import styles from "../styles/ExpedientDocuments.module.css";
import type { ManagerInfo } from "../types/expedient.types";

type Props = {
  canUse: boolean;
  loadingManager: boolean;
  manager: ManagerInfo | null;
  policyNumber: string;
  cfdi: string;
  savingManager: boolean;
  savingPolicy: boolean;
  savingCfdi: boolean;
  savingChecklist: boolean;
  onOpenManager: () => void;
  onOpenPolicy: () => void;
  onOpenCfdi: () => void;
  onOpenChecklist: () => void;
  getManagerDisplayName: (m: ManagerInfo | null) => string;
};

export default function ExpedientHeaderInfo({
  canUse,
  loadingManager,
  manager,
  policyNumber,
  cfdi,
  savingManager,
  savingPolicy,
  savingCfdi,
  savingChecklist,
  onOpenManager,
  onOpenPolicy,
  onOpenCfdi,
  onOpenChecklist,
  getManagerDisplayName,
}: Props) {
  return (
    <div className={styles.cardNoteInline}>
      <div className={styles.inlineInfoGroup}>
        <div className={styles.managerBox}>
          <span className={styles.managerInlineLabel}>Responsable:</span>

          <span
            className={styles.managerHeaderName}
            title={getManagerDisplayName(manager)}
          >
            <strong>
              {loadingManager
                ? "Cargando..."
                : manager?.email || "Sin responsable"}
            </strong>
          </span>

          <button
            type="button"
            className={styles.managerActionBtn}
            onClick={onOpenManager}
            disabled={!canUse || savingManager}
          >
            {manager ? "Editar responsable" : "Asignar responsable"}
          </button>
        </div>

        <div className={styles.policyBox}>
          <span className={styles.policyInlineLabel}>Póliza:</span>

          <span
            className={styles.policyHeaderName}
            title={policyNumber?.trim() || "Sin póliza"}
          >
            {policyNumber?.trim() || "Sin póliza"}
          </span>

          <button
            type="button"
            className={styles.policyActionBtn}
            onClick={onOpenPolicy}
            disabled={!canUse || savingPolicy}
          >
            {policyNumber?.trim() ? "Editar póliza" : "Agregar póliza"}
          </button>
        </div>

        <div className={styles.cfdiBox}>
          <span className={styles.cfdiInlineLabel}>CFDI:</span>

          <span
            className={styles.cfdiHeaderName}
            title={cfdi?.trim() || "Sin CFDI"}
          >
            {cfdi?.trim() || "Sin CFDI"}
          </span>

          <button
            type="button"
            className={styles.cfdiActionBtn}
            onClick={onOpenCfdi}
            disabled={!canUse || savingCfdi}
          >
            {cfdi?.trim() ? "Editar CFDI" : "Agregar CFDI"}
          </button>
        </div>

        <button
          type="button"
          className={styles.headerEditChecklistBtn}
          onClick={onOpenChecklist}
          disabled={!canUse || savingChecklist}
        >
          Editar checklist
        </button>
      </div>
    </div>
  );
}
