import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "../styles/ExpedientDocuments.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type ChecklistRow = {
  documentTypeId: number;
  documentName: string;
  requiredByRule: boolean;
  noApplies: boolean;
  uploaded: boolean;
  fileName?: string | null;
  fileUrl?: string | null;
};

type UploadRow = {
  file: File;
  documentTypeId: number | null;
  observations: string;
};

type RequestOk = { ok: true; data: unknown; status: number };
type RequestErr = { ok: false; error: string; status: number };
type RequestResult = RequestOk | RequestErr;

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toStringSafe(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeChecklist(payload: unknown): ChecklistRow[] {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? asArray(payload["items"] ?? payload["data"] ?? payload["result"])
      : [];

  return list
    .map((raw): ChecklistRow | null => {
      if (!isRecord(raw)) return null;

      const documentTypeId = toNumber(raw["documentTypeId"] ?? raw["DocumentTypeId"]);
      const documentName = toStringSafe(raw["documentName"] ?? raw["DocumentName"]).trim();

      if (!documentTypeId || !documentName) return null;

      return {
        documentTypeId,
        documentName,
        requiredByRule: toBool(raw["requiredByRule"] ?? raw["RequiredByRule"]),
        noApplies: toBool(raw["noApplies"] ?? raw["NoApplies"]),
        uploaded: toBool(raw["uploaded"] ?? raw["Uploaded"]),
        fileName: toStringSafe(raw["fileName"] ?? raw["FileName"]) || null,
        fileUrl: toStringSafe(raw["fileUrl"] ?? raw["FileUrl"]) || null,
      };
    })
    .filter((x): x is ChecklistRow => x !== null);
}

function bytesToHuman(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function makeDocLabel(row: ChecklistRow) {
  const badges: string[] = [];
  if (row.requiredByRule) badges.push("Obligatorio");
  if (row.noApplies) badges.push("No aplica");
  if (row.uploaded) badges.push("Cargado");
  return badges.join(" · ");
}

const API = "/api/ExpedientDocument";

export default function ExpedientDocuments() {
  const navigate = useNavigate();

  // asumo ruta: /adquisiciones/:id/expediente o /expediente/:id
  const params = useParams();
  const requestId = useMemo(() => {
    const raw = params.id ?? params.requestId ?? "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [params]);

  // checklist
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);

  // search
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ChecklistRow[]>([]); // reuso estructura tipo checklist

  // upload
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const canUse = requestId > 0;

  const loadChecklist = useCallback(async () => {
    if (!canUse) return;

    setLoadingChecklist(true);
    try {
      const res = (await requestJson(`${API}/${requestId}/documents-checklist`, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

      if (!res.ok) {
        setChecklist([]);
        showToast("error", res.error || "No se pudo cargar el checklist.");
        return;
      }

      const list = normalizeChecklist(res.data);
      // orden: obligatorios arriba, luego por nombre
      list.sort((a, b) => {
        if (a.requiredByRule !== b.requiredByRule) return a.requiredByRule ? -1 : 1;
        return a.documentName.localeCompare(b.documentName, "es");
      });

      setChecklist(list);
    } catch {
      setChecklist([]);
      showToast("error", "Error inesperado al cargar el checklist.");
    } finally {
      setLoadingChecklist(false);
    }
  }, [canUse, requestId, showToast]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  const stats = useMemo(() => {
    const total = checklist.length;
    const required = checklist.filter((x) => x.requiredByRule && !x.noApplies).length;
    const uploadedOk = checklist.filter((x) => x.uploaded).length;
    const requiredUploaded = checklist.filter((x) => x.requiredByRule && !x.noApplies && x.uploaded).length;
    const missingRequired = Math.max(0, required - requiredUploaded);
    return { total, required, uploadedOk, requiredUploaded, missingRequired };
  }, [checklist]);

  const missingRequiredList = useMemo(() => {
    return checklist.filter((x) => x.requiredByRule && !x.noApplies && !x.uploaded);
  }, [checklist]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    setUploads((prev) => {
      const next: UploadRow[] = [...prev];

      for (const f of arr) {
        next.push({
          file: f,
          documentTypeId: null,
          observations: "",
        });
      }
      return next;
    });

    showToast("success", `${arr.length} archivo(s) agregados.`);
  }

  function onPickFiles() {
    fileInputRef.current?.click();
  }

  function onRemoveUpload(idx: number) {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  }

  function onBindFromChecklist(uploadIdx: number, docTypeId: number) {
    setUploads((prev) =>
      prev.map((u, i) => (i === uploadIdx ? { ...u, documentTypeId: docTypeId } : u))
    );
  }

  const checklistOptions = useMemo(() => {
    // solo documentos que existan en checklist (para asignar a un archivo)
    return checklist.map((c) => ({
      id: c.documentTypeId,
      name: c.documentName,
      required: c.requiredByRule && !c.noApplies,
      uploaded: c.uploaded,
    }));
  }, [checklist]);

  const canUpload = canUse && uploads.length > 0 && !uploading;

  async function onUploadMassive() {
    if (!canUse) return showToast("error", "RequestId inválido.");
    if (uploads.length === 0) return showToast("error", "Agrega archivos antes de subir.");

    // Validación mínima: si hay docs obligatorios faltantes, no forzamos; solo sugerimos.
    const unassigned = uploads.filter((u) => !u.documentTypeId).length;
    if (unassigned > 0) {
      return showToast("error", `Faltan ${unassigned} archivo(s) por asignar a un tipo de documento.`);
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("requestId", String(requestId));

      uploads.forEach((u) => {
        fd.append("files", u.file);
        fd.append("documentTypeId", String(u.documentTypeId ?? ""));
        fd.append("observations", u.observations ?? "");
      });

      const resp = await fetch(`${API}/upload-massive`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          // OJO: NO pongas Content-Type aquí, fetch lo pone con boundary.
        },
        body: fd,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Error HTTP ${resp.status}`);
      }

      showToast("success", "Carga masiva realizada correctamente.");
      setUploads([]);
      await loadChecklist(); // refresca estados (Uploaded)
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Error inesperado al subir archivos.");
    } finally {
      setUploading(false);
    }
  }

  async function onSearch() {
    if (!canUse) return showToast("error", "RequestId inválido.");
    const q = searchText.trim();
    if (!q) return showToast("error", "Escribe un nombre para buscar.");

    setSearching(true);
    try {
      const url = `${API}/search?requestId=${encodeURIComponent(String(requestId))}&fileName=${encodeURIComponent(q)}`;
      const res = (await requestJson(url, { method: "GET", headers: authHeaders() })) as RequestResult;

      if (!res.ok) {
        setSearchResults([]);
        showToast("error", res.error || "No se pudo buscar.");
        return;
      }

      // El endpoint devuelve documentos, pero no pusiste DTO de salida.
      // Intento normalizar a formato "ChecklistRow" mínimo para mostrar.
      const list = normalizeChecklist(res.data);
      setSearchResults(list);
    } catch {
      setSearchResults([]);
      showToast("error", "Error inesperado al buscar.");
    } finally {
      setSearching(false);
    }
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
  };

  return (
    <div className={styles.page}>
      <Toast open={toastOpen} type={toastType} message={toastMsg} onClose={() => setToastOpen(false)} durationMs={3200} />

      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.breadcrumbs}>
            <button type="button" className={styles.crumbBtn} onClick={() => navigate("/home")}>
              Inicio
            </button>
            <span className={styles.crumbSep}>/</span>
            <span className={styles.crumbCurrent}>Expediente</span>
          </div>

          <h1 className={styles.title}>Expediente de la solicitud</h1>
          <p className={styles.subtitle}>
            {canUse ? `RequestId: ${requestId}` : "No se detectó el id de la solicitud en la ruta."}
          </p>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpiChip}>
            <span>Total docs</span>
            <b>{stats.total}</b>
          </div>
          <div className={`${styles.kpiChip} ${styles.kpiWarn}`}>
            <span>Obligatorios</span>
            <b>{stats.required}</b>
          </div>
          <div className={`${styles.kpiChip} ${styles.kpiOk}`}>
            <span>Cargados</span>
            <b>{stats.uploadedOk}</b>
          </div>
          <div className={`${styles.kpiChip} ${styles.kpiBad}`}>
            <span>Faltan oblig.</span>
            <b>{stats.missingRequired}</b>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {/* LEFT: CHECKLIST */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle}>Checklist</div>
              <div className={styles.cardNote}>Documentos requeridos / cargados por la solicitud</div>
            </div>

            <button type="button" className={styles.ghostBtn} onClick={() => void loadChecklist()} disabled={!canUse || loadingChecklist}>
              {loadingChecklist ? "Cargando..." : "Recargar"}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Regla</th>
                  <th>Estado</th>
                  <th className={styles.thRight}>Archivo</th>
                </tr>
              </thead>

              <tbody>
                {!canUse ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      No hay requestId válido en la URL.
                    </td>
                  </tr>
                ) : loadingChecklist ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      Cargando checklist...
                    </td>
                  </tr>
                ) : checklist.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      Sin checklist para esta solicitud.
                    </td>
                  </tr>
                ) : (
                  checklist.map((c) => {
                    const badgeClass = c.noApplies
                      ? styles.badgeNeutral
                      : c.uploaded
                        ? styles.badgeOk
                        : c.requiredByRule
                          ? styles.badgeBad
                          : styles.badgeNeutral;

                    const badgeText = c.noApplies ? "No aplica" : c.uploaded ? "Cargado" : c.requiredByRule ? "Falta" : "Opcional";

                    return (
                      <tr key={c.documentTypeId}>
                        <td className={styles.ellipsis} title={c.documentName}>
                          <div className={styles.docName}>{c.documentName}</div>
                          <div className={styles.docMeta}>{makeDocLabel(c)}</div>
                        </td>
                        <td>
                          <span className={`${styles.pill} ${c.requiredByRule && !c.noApplies ? styles.pillWarn : styles.pillNeutral}`}>
                            {c.requiredByRule ? "Regla" : "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>
                        </td>
                        <td className={styles.tdRight}>
                          {c.fileUrl ? (
                            <a className={styles.linkBtn} href={c.fileUrl} target="_blank" rel="noreferrer">
                              {c.fileName || "Ver"}
                            </a>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {missingRequiredList.length > 0 && (
            <div className={styles.footerHint}>
              <b>Faltan obligatorios:</b> {missingRequiredList.slice(0, 4).map((x) => x.documentName).join(", ")}
              {missingRequiredList.length > 4 ? "…" : ""}
            </div>
          )}
        </section>

        {/* RIGHT: UPLOAD + SEARCH */}
        <div className={styles.rightCol}>
          {/* Upload */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>Carga masiva</div>
                <div className={styles.cardNote}>Sube varios archivos y asigna su tipo</div>
              </div>

              <button type="button" className={styles.primaryBtn} onClick={onPickFiles} disabled={!canUse || uploading}>
                Agregar archivos
              </button>

              <input
                ref={fileInputRef}
                className={styles.hiddenFile}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className={styles.dropzone} {...dropHandlers}>
              <div className={styles.dropTitle}>Arrastra archivos aquí</div>
              <div className={styles.dropSub}>o usa “Agregar archivos”.</div>
            </div>

            {uploads.length === 0 ? (
              <div className={styles.emptyBox}>Aún no has agregado archivos.</div>
            ) : (
              <div className={styles.uploadList}>
                {uploads.map((u, idx) => (
                  <div key={`${u.file.name}-${idx}`} className={styles.uploadRow}>
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName} title={u.file.name}>
                        {u.file.name}
                      </div>
                      <div className={styles.fileMeta}>{bytesToHuman(u.file.size)}</div>
                    </div>

                    <div className={styles.uploadControls}>
                      <select
                        className={styles.select}
                        value={u.documentTypeId ?? ""}
                        onChange={(e) => onBindFromChecklist(idx, Number(e.target.value))}
                        disabled={uploading}
                      >
                        <option value="">Asignar tipo…</option>
                        {checklistOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.required ? " (Obligatorio)" : ""}
                            {o.uploaded ? " ✓" : ""}
                          </option>
                        ))}
                      </select>

                      <input
                        className={styles.input}
                        placeholder="Observaciones (opcional)"
                        value={u.observations}
                        onChange={(e) =>
                          setUploads((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, observations: e.target.value } : x))
                          )
                        }
                        disabled={uploading}
                      />

                      <button type="button" className={styles.dangerBtn} onClick={() => onRemoveUpload(idx)} disabled={uploading}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setUploads([])} disabled={!canUse || uploading || uploads.length === 0}>
                Limpiar lista
              </button>

              <button type="button" className={styles.saveBtn} onClick={() => void onUploadMassive()} disabled={!canUpload}>
                {uploading ? "Subiendo..." : "Subir todo"}
              </button>
            </div>
          </section>

          {/* Search */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>Buscar documento</div>
                <div className={styles.cardNote}>Busca por nombre dentro de esta solicitud</div>
              </div>
            </div>

            <div className={styles.searchRow}>
              <input
                className={styles.input}
                placeholder="Ej. oficio, contrato, factura..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={!canUse || searching}
              />
              <button type="button" className={styles.primaryBtn} onClick={() => void onSearch()} disabled={!canUse || searching}>
                {searching ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className={styles.emptyBox}>Sin resultados.</div>
            ) : (
              <div className={styles.resultList}>
                {searchResults.map((r) => (
                  <div key={r.documentTypeId} className={styles.resultItem}>
                    <div className={styles.resultTitle}>{r.documentName}</div>
                    <div className={styles.resultMeta}>{r.fileName || "—"}</div>
                    {r.fileUrl ? (
                      <a className={styles.linkBtn} href={r.fileUrl} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}