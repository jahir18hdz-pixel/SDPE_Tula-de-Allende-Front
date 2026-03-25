import React from "react";
import styles from "../styles/ExpedientDocuments.module.css";
import type { UploadRow,  } from "../types/expedient.types";
import { bytesToHuman } from "../utils/expedient.utils";

type Props = {
  open: boolean;
  canUse: boolean;
  uploading: boolean;
  uploads: UploadRow[];
  checklistOptions: {
    id: number;
    name: string;
    required: boolean;
    uploaded: boolean;
    noApplies: boolean;
  }[];
  onClose: () => void;
  onPickFiles: () => void;
  onRemoveUpload: (idx: number) => void;
  onBindFromChecklist: (uploadIdx: number, docTypeId: number | null) => void;
  setUploads: React.Dispatch<React.SetStateAction<UploadRow[]>>;
  onUploadMassive: () => void;
  dropHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
};

export default function UploadPanel({
  open,
  canUse,
  uploading,
  uploads,
  checklistOptions,
  onClose,
  onPickFiles,
  onRemoveUpload,
  onBindFromChecklist,
  setUploads,
  onUploadMassive,
  dropHandlers,
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
            <div className={styles.uploadSheetTitle}>Carga de archivos</div>
            <div className={styles.uploadSheetNote}>
              Selecciona varios archivos y asigna cada uno al documento
              correspondiente
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onPickFiles}
              disabled={!canUse || uploading}
            >
              Seleccionar archivos
            </button>

            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => {
                setUploads([]);
                onClose();
              }}
              disabled={uploading}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          <div className={styles.dropzoneLarge} {...dropHandlers}>
            <div className={styles.dropTitle}>Arrastra archivos aquí</div>
            <div className={styles.dropSub}>o usa “Seleccionar archivos”.</div>
          </div>

          {uploads.length === 0 ? (
            <div className={styles.emptyUploadState}>
              Aún no has agregado archivos.
            </div>
          ) : (
            <div className={styles.uploadListFullscreen}>
              {uploads.map((u, idx) => (
                <div key={`${u.file.name}-${idx}`} className={styles.uploadRow}>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName} title={u.file.name}>
                      {u.file.name}
                    </div>
                    <div className={styles.fileMeta}>
                      {bytesToHuman(u.file.size)}
                    </div>
                  </div>

                  <div className={styles.uploadControls}>
                    <div className={styles.editorFloatingSelectField}>
                      <span className={styles.editorFloatingLabel}>
                        Tipo de documento
                      </span>

                      <select
                        className={styles.editorFloatingSelect}
                        value={u.documentTypeId ?? ""}
                        onChange={(e) =>
                          onBindFromChecklist(
                            idx,
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        disabled={uploading}
                      >
                        <option value="">Asignar tipo…</option>

                        {checklistOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.required && !o.uploaded
                              ? `🔴 ${o.name} (Obligatorio)`
                              : o.uploaded
                                ? `🟢 ${o.name} ✓`
                                : o.noApplies
                                  ? `⚪ ${o.name} (No aplica)`
                                  : `🟡 ${o.name}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.editorFloatingField}>
                      <span className={styles.editorFloatingLabel}>
                        Observaciones
                      </span>
                      <input
                        className={styles.editorFloatingInput}
                        value={u.observations}
                        onChange={(e) =>
                          setUploads((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, observations: e.target.value }
                                : x,
                            ),
                          )
                        }
                        disabled={uploading}
                        placeholder="Escribe una observación"
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => onRemoveUpload(idx)}
                      disabled={uploading}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.uploadSheetFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => setUploads([])}
            disabled={!canUse || uploading || uploads.length === 0}
          >
            Limpiar lista
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={onUploadMassive}
            disabled={!canUse || uploads.length === 0 || uploading}
          >
            {uploading ? "Subiendo..." : "Subir todo"}
          </button>
        </div>
      </div>
    </div>
  );
}