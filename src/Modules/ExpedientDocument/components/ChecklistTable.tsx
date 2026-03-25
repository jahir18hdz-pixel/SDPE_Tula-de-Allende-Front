import styles from "../styles/ExpedientDocuments.module.css";
import type { ToastType } from "../../../Components/layout/Toast";
import type { ChecklistRow } from "../types/expedient.types";

type Props = {
  canUse: boolean;
  loadingChecklist: boolean;
  checklist: ChecklistRow[];
  filteredChecklist: ChecklistRow[];
  searchText: string;
  showToast: (type: ToastType, msg: string) => void;
  openPreviewFromFiles: (row: ChecklistRow, selectedIndex?: number) => void;
};

const getStatusClass = (status?: string) => {
  const s = (status ?? "").trim().toLowerCase();

  if (s.includes("completo")) return styles.statusComplete;
  if (s.includes("observado")) return styles.statusObserved;
  if (s.includes("cargado")) return styles.statusLoaded;
  if (s.includes("no aplica")) return styles.statusNotApply;

  return styles.statusDefault;
};

function getStatusText(row: ChecklistRow) {
  return row.globalStatus?.trim() || (row.uploaded ? "Cargado" : "Pendiente");
}

export default function ChecklistTable({
  canUse,
  loadingChecklist,
  checklist,
  filteredChecklist,
  searchText,
  showToast,
  openPreviewFromFiles,
}: Props) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Estado</th>
            <th className={styles.thRight}>Archivo(s)</th>
          </tr>
        </thead>

        <tbody>
          {!canUse ? (
            <tr>
              <td colSpan={3} className={styles.empty}>
                No hay requestId válido en la URL.
              </td>
            </tr>
          ) : loadingChecklist ? (
            <tr>
              <td colSpan={3} className={styles.empty}>
                Cargando checklist...
              </td>
            </tr>
          ) : filteredChecklist.length === 0 ? (
            <tr>
              <td colSpan={3} className={styles.empty}>
                {checklist.length === 0
                  ? "Sin checklist para esta solicitud."
                  : `No se encontraron documentos con “${searchText.trim()}”.`}
              </td>
            </tr>
          ) : (
            filteredChecklist.map((c) => {
              const isRequired = c.requiredByRule && !c.noApplies;
              const hasFiles = c.files.length > 0;
              const stateText = getStatusText(c);
              const stateClass = getStatusClass(stateText);

              return (
                <tr key={c.documentTypeId}>
                  <td className={styles.docCell}>
                    <div
                      className={`${styles.docCard} ${hasFiles ? styles.clickable : ""}`}
                      title={c.documentName}
                      role={hasFiles ? "button" : undefined}
                      tabIndex={hasFiles ? 0 : -1}
                      onClick={() =>
                        hasFiles
                          ? openPreviewFromFiles(c, 0)
                          : showToast(
                              "error",
                              "Este documento aún no tiene archivo.",
                            )
                      }
                      onKeyDown={(e) => {
                        if (!hasFiles) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPreviewFromFiles(c, 0);
                        }
                      }}
                    >
                      <div className={styles.docName}>{c.documentName}</div>

                      <div className={styles.docMeta}>
                        {isRequired && (
                          <span className={styles.metaTagWarn}>Obligatorio</span>
                        )}

                        {c.noApplies && (
                          <span className={styles.metaTag}>No aplica</span>
                        )}

                        {c.uploaded && (
                          <span className={styles.metaTagOk}>Cargado</span>
                        )}

                        {!c.uploaded && !c.noApplies && !isRequired && (
                          <span className={styles.metaTag}>Opcional</span>
                        )}

                        {hasFiles && (
                          <span className={styles.metaTag}>
                            {c.files.length} archivo
                            {c.files.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`${styles.statusPill} ${stateClass}`}>
                      {stateText}
                    </span>
                  </td>

                  <td className={styles.tdRight}>
                    {!hasFiles ? (
                      <span className={styles.fileEmpty}>Sin archivo</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.fileLink}
                        onClick={() => openPreviewFromFiles(c, 0)}
                        title={
                          c.files.length === 1
                            ? (c.files[0]?.name ?? "Previsualizar archivo")
                            : `Previsualizar ${c.files.length} archivos`
                        }
                      >
                        Ver archivo
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}