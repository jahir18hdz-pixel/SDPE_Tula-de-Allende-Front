import styles from "../styles/ChecklistDeDocumentos.module.css";
import type { ManagerInfo } from "../types/expedient.types";

type Props = {
  canUse: boolean;
  requestId: number;
  loadingManager: boolean;
  manager: ManagerInfo | null;
  policyNumber: string;
  cfdi: string;
  savingManager: boolean;
  savingPolicy: boolean;
  savingCfdi: boolean;
  savingChecklist: boolean;
  downloadingChecklistPdf?: boolean;
  onOpenManager: () => void;
  onOpenPolicy: () => void;
  onOpenCfdi: () => void;
  onOpenChecklist: () => void;
  onDownloadChecklistPdf: () => void;
  getManagerDisplayName: (m: ManagerInfo | null) => string;
};

export default function ExpedientHeaderInfo({
  canUse,
  requestId,
  loadingManager,
  manager,
  policyNumber,
  cfdi,
  savingManager,
  savingPolicy,
  savingCfdi,
  savingChecklist,
  downloadingChecklistPdf = false,
  onOpenManager,
  onOpenPolicy,
  onOpenCfdi,
  onOpenChecklist,
  onDownloadChecklistPdf,
  getManagerDisplayName,
}: Props) {
  const managerText = loadingManager
    ? "Cargando..."
    : manager?.email || "Sin responsable";

  const policyText = policyNumber?.trim() || "Sin póliza";
  const cfdiText = cfdi?.trim() || "Sin CFDI";

  return (
    <div className={styles.cardNoteInline}>
      <div className={styles.inlineInfoGroup}>
        <div className={styles.managerBox}>
          <span className={styles.managerInlineLabel}>Responsable</span>

          <button
            type="button"
            className={styles.managerHeaderName}
            title={getManagerDisplayName(manager)}
            onClick={onOpenManager}
            disabled={!canUse || savingManager || loadingManager}
          >
            <strong>{managerText}</strong>
          </button>
        </div>

        <div className={styles.policyBox}>
          <span className={styles.policyInlineLabel}>Póliza</span>

          <button
            type="button"
            className={styles.policyHeaderName}
            title={policyText}
            onClick={onOpenPolicy}
            disabled={!canUse || savingPolicy}
          >
            {policyText}
          </button>
        </div>

        <div className={styles.cfdiBox}>
          <span className={styles.cfdiInlineLabel}>CFDI</span>

          <button
            type="button"
            className={styles.cfdiHeaderName}
            title={cfdiText}
            onClick={onOpenCfdi}
            disabled={!canUse || savingCfdi}
          >
            {cfdiText}
          </button>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerPdfCheckBtn}
            onClick={onDownloadChecklistPdf}
            disabled={!canUse || !requestId || downloadingChecklistPdf}
          >
            {downloadingChecklistPdf ? "Descargando..." : "PDF CHECKLIST"}
          </button>

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
    </div>
  );
  
}
