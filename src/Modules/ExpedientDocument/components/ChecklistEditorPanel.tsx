import React from "react";
import styles from "../styles/ExpedientDocuments.module.css";
import type { ChecklistExceptionRow } from "../types/expedient.types";

type Props = {
  open: boolean;
  savingChecklist: boolean;
  checklistExceptionRows: ChecklistExceptionRow[];
  setChecklistExceptionRows: React.Dispatch<
    React.SetStateAction<ChecklistExceptionRow[]>
  >;
  onClose: () => void;
  onSave: () => void;
};

export default function ChecklistEditorPanel({
  open,
  savingChecklist,
  checklistExceptionRows,
  setChecklistExceptionRows,
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
            <div className={styles.uploadSheetTitle}>Editar checklist</div>
            <div className={styles.uploadSheetNote}>
              Define claramente si cada documento es obligatorio o no aplica
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onClose}
              disabled={savingChecklist}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          {checklistExceptionRows.length === 0 ? (
            <div className={styles.emptyUploadState}>
              No hay documentos obligatorios para editar.
            </div>
          ) : (
            <div className={styles.checklistCompactWrap}>
              <div className={styles.checklistCompactHeader}>
                <div className={styles.checklistCompactHeaderDoc}>Documento</div>
                <div className={styles.checklistCompactHeaderState}>Estado</div>
              </div>

              <div className={styles.checklistCompactList}>
                {checklistExceptionRows.map((row) => {
                  const isRequired = !row.doesNotApply;

                  return (
                    <div
                      key={row.documentTypeId}
                      className={`${styles.checklistCompactCard} ${
                        row.uploaded
                          ? styles.checklistStateUploaded
                          : row.doesNotApply
                            ? styles.checklistStateNoApply
                            : styles.checklistStateRequired
                      }`}
                    >
                      <div className={styles.checklistCompactTop}>
                        <div className={styles.checklistCompactDocBlock}>
                          <div className={styles.checklistCompactDocName}>
                            {row.documentName}
                          </div>

                          <div className={styles.checklistCompactBadges}>
                            {row.uploaded && (
                              <span className={styles.checklistCompactBadgeOk}>
                                Completo
                              </span>
                            )}

                            <span
                              className={
                                row.doesNotApply
                                  ? styles.checklistCompactBadgeNeutral
                                  : styles.checklistCompactBadgeWarn
                              }
                            >
                              {row.doesNotApply ? "No aplica" : "Obligatorio"}
                            </span>
                          </div>
                        </div>

                        <div className={styles.checklistCompactStateBlock}>
                          <label className={styles.checklistCompactOption}>
                            <span className={styles.checklistCompactOptionLabel}>
                              No aplica
                            </span>
                            <input
                              type="radio"
                              name={`checklist-state-${row.documentTypeId}`}
                              checked={row.doesNotApply}
                              onChange={() =>
                                setChecklistExceptionRows((prev) =>
                                  prev.map((item) =>
                                    item.documentTypeId === row.documentTypeId
                                      ? {
                                          ...item,
                                          doesNotApply: true,
                                          justification:
                                            item.justification.trim() ||
                                            "No aplica",
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={savingChecklist}
                            />
                          </label>

                          <label className={styles.checklistCompactOption}>
                            <span className={styles.checklistCompactOptionLabel}>
                              Obligatorio
                            </span>
                            <input
                              type="radio"
                              name={`checklist-state-${row.documentTypeId}`}
                              checked={isRequired}
                              onChange={() =>
                                setChecklistExceptionRows((prev) =>
                                  prev.map((item) =>
                                    item.documentTypeId === row.documentTypeId
                                      ? {
                                          ...item,
                                          doesNotApply: false,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={savingChecklist}
                            />
                          </label>
                        </div>
                      </div>

                      <div className={styles.checklistCompactBottom}>
                        <label className={styles.fieldLabel}>Justificación</label>
                        <textarea
                          className={styles.checklistCompactTextarea}
                          value={row.doesNotApply ? row.justification : "Aplica"}
                          onChange={(e) =>
                            setChecklistExceptionRows((prev) =>
                              prev.map((item) =>
                                item.documentTypeId === row.documentTypeId
                                  ? { ...item, justification: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          disabled={savingChecklist || !row.doesNotApply}
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.uploadSheetFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={savingChecklist}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={savingChecklist}
          >
            {savingChecklist ? "Guardando..." : "Guardar checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}