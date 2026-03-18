import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/PaymentPolicy.module.css";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type PaymentPolicyRow = {
  idPaymentPolicy?: number;
  IdPaymentPolicy?: number;
  id?: number;
  Id?: number;

  policyCode?: string;
  PolicyCode?: string;

  description?: string | null;
  Description?: string | null;

  previewUrl?: string;
  PreviewUrl?: string;

  [key: string]: unknown;
};

type CreateForm = {
  policyCode: string;
  description: string;
  file: File | null;
};

type EditForm = {
  idPaymentPolicy: string;
  policyCode: string;
  description: string;
  file: File | null;
};

type DeleteForm = {
  password: string;
};

const POLICY_BASE = "/api/PaymentPolicy";

const initialCreate: CreateForm = {
  policyCode: "",
  description: "",
  file: null,
};

export default function PaymentPolicy() {
  const [rows, setRows] = useState<PaymentPolicyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<PaymentPolicyRow | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const [create, setCreate] = useState<CreateForm>(initialCreate);
  const [edit, setEdit] = useState<EditForm>({
    idPaymentPolicy: "",
    policyCode: "",
    description: "",
    file: null,
  });
  const [deleteForm, setDeleteForm] = useState<DeleteForm>({ password: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const selectedId = useMemo(() => getId(selected), [selected]);

  const selectedIdRef = useRef<number | null>(null);
  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const loadPaged = useCallback(
    async (nextPage: number, nextPageSize: number) => {
      setLoading(true);
      try {
        const result = await requestJson(
          `${POLICY_BASE}/policies?page=${nextPage}&pageSize=${nextPageSize}`,
          { method: "GET", headers: authHeaders() }
        );

        if (!result.ok) {
          showToast("error", result.error);
          setRows([]);
          setHasNextPage(false);
          return;
        }

        const items = normalizePolicies(result.data);
        setRows(items);
        setPage(nextPage);
        setPageSize(nextPageSize);
        setHasNextPage(items.length >= nextPageSize);

        const keepId = selectedIdRef.current;
        if (keepId != null) {
          const found = items.find((d) => getId(d) === keepId) ?? null;
          setSelected(found);

          if (found && modeRef.current === "edit") {
            setEdit({
              idPaymentPolicy: String(getId(found) ?? ""),
              policyCode: getPolicyCode(found) ?? "",
              description: getDescription(found) ?? "",
              file: null,
            });
          }
        }
      } catch (e: unknown) {
        showToast("error", toErrorMessage(e));
        setRows([]);
        setHasNextPage(false);
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadPaged(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((d) => {
      const code = (getPolicyCode(d) ?? "").toLowerCase();
      const desc = (getDescription(d) ?? "").toLowerCase();
      return code.includes(q) || desc.includes(q);
    });
  }, [rows, search]);

  function onRowClick(row: PaymentPolicyRow) {
    setSelected(row);
    setMode("view");
    setDeleteForm({ password: "" });
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setCreate(initialCreate);
    setDeleteForm({ password: "" });
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
    setDeleteForm({ password: "" });
  }

  function startEdit() {
    if (!selected) return;

    setEdit({
      idPaymentPolicy: String(getId(selected) ?? ""),
      policyCode: getPolicyCode(selected) ?? "",
      description: getDescription(selected) ?? "",
      file: null,
    });

    setMode("edit");
  }

  function openDeleteModal() {
    if (!selected) return;
    setDeleteForm({ password: "" });
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteForm({ password: "" });
  }

  function validateCreate(): string {
    const code = create.policyCode.trim();
    if (!code) return "El código de póliza es obligatorio.";
    if (code.length < 2) return "El código de póliza es demasiado corto.";
    if (!create.file) return "Debes seleccionar un archivo PDF.";
    if (!isPdfFile(create.file)) return "El archivo debe ser un PDF.";
    return "";
  }

  async function onCreate() {
    const msg = validateCreate();
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("PolicyCode", create.policyCode.trim());
      formData.append("Description", create.description.trim());
      if (create.file) formData.append("File", create.file);

      const response = await fetch(POLICY_BASE, {
        method: "POST",
        headers: authFormHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const txt = await safeReadError(response);
        return showToast("error", txt || "No se pudo crear la póliza.");
      }

      showToast("success", "Póliza creada correctamente");
      setMode("view");
      setCreate(initialCreate);
      await loadPaged(1, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function validateEdit(): string {
    const id = Number(edit.idPaymentPolicy);
    if (!Number.isFinite(id) || id <= 0) return "Id de póliza inválido.";

    const code = edit.policyCode.trim();
    if (!code) return "El código de póliza es obligatorio.";

    if (edit.file && !isPdfFile(edit.file)) {
      return "El archivo debe ser un PDF.";
    }

    return "";
  }

  async function onSaveEdit() {
    if (!selected) return;

    const msg = validateEdit();
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("IdPaymentPolicy", edit.idPaymentPolicy);
      formData.append("PolicyCode", edit.policyCode.trim());
      formData.append("Description", edit.description.trim());
      if (edit.file) formData.append("File", edit.file);

      const response = await fetch(`${POLICY_BASE}/payment-policies`, {
        method: "PUT",
        headers: authFormHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const txt = await safeReadError(response);
        return showToast("error", txt || "No se pudo actualizar la póliza.");
      }

      showToast("success", "Póliza actualizada");
      setMode("view");
      setSelected(null);
      await loadPaged(page, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selected) return;

    const id = getId(selected);
    if (!id) return showToast("error", "No se pudo identificar la póliza.");

    if (!deleteForm.password.trim()) {
      return showToast("error", "Debes escribir la contraseña para eliminar.");
    }

    setDeleting(true);
    try {
      const result = await requestJson(`${POLICY_BASE}/payment-policies`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({
          idPaymentPolicy: id,
          password: deleteForm.password.trim(),
        }),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Póliza eliminada correctamente");
      setDeleteForm({ password: "" });
      setDeleteModalOpen(false);
      setSelected(null);
      setMode("view");

      const fallbackPage = page > 1 && rows.length === 1 ? page - 1 : page;
      await loadPaged(fallbackPage, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  async function onDownload(row: PaymentPolicyRow) {
    const id = getId(row);
    if (!id) {
      showToast("error", "No se pudo identificar la póliza.");
      return;
    }

    try {
      const response = await fetch(`${POLICY_BASE}/payment-policies/${id}/download`, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!response.ok) {
        const txt = await safeReadError(response);
        showToast("error", txt || "No se pudo descargar la póliza.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const disposition = response.headers.get("content-disposition");
      const fileName = extractFileName(disposition) || `${getPolicyCode(row) ?? "poliza"}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    }
  }

  const busy = saving || loading || deleting;

  return (
    <div className={styles.page}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Pólizas de pago</h1>
            <p className={styles.sub}>Administra las pólizas y sus archivos PDF.</p>
          </div>

          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Buscar por código o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy}
            />

            {search.trim() !== "" && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                type="button"
                aria-label="Limpiar búsqueda"
                disabled={busy}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnPrimary}
              onClick={startCreate}
              disabled={saving || mode === "create"}
              type="button"
            >
              {mode === "create" ? "Creando..." : "+ Nueva póliza"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Listado</p>

            <div className={styles.pager}>
              <select
                className={styles.pageSize}
                value={pageSize}
                disabled={busy}
                onChange={(e) => {
                  const ps = Number(e.target.value);
                  void loadPaged(1, ps);
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / pág
                  </option>
                ))}
              </select>

              <div className={styles.pagerBtns}>
                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={busy || page <= 1}
                  onClick={() => void loadPaged(Math.max(1, page - 1), pageSize)}
                >
                  Anterior
                </button>

                <span className={styles.pagerInfo}>{page}</span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={busy || !hasNextPage}
                  onClick={() => void loadPaged(page + 1, pageSize)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Archivo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando pólizas...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {search.trim()
                        ? "No se encontraron pólizas con esos criterios."
                        : "No hay pólizas registradas."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((d, idx) => {
                    const id = getId(d);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected = selectedId != null && id != null && id === selectedId;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(d)}
                      >
                        <td className={styles.mono}>{getPolicyCode(d) ?? "—"}</td>
                        <td>{getDescription(d) ?? "—"}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnMini}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDownload(d);
                            }}
                          >
                            Descargar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>
              {mode === "create" ? "Nueva póliza" : mode === "edit" ? "Editar póliza" : "Detalle"}
            </p>
          </div>

          <div className={styles.panelBody}>
            {mode === "create" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onCreate();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailCard}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Código de póliza <span className={styles.required}>*</span>
                      </span>
                      <input
                        className={styles.floatingInput}
                        value={create.policyCode}
                        onChange={(e) => setCreate((p) => ({ ...p, policyCode: e.target.value }))}
                        disabled={busy}
                        placeholder="Ej. POL-2026-001"
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={create.description}
                        onChange={(e) => setCreate((p) => ({ ...p, description: e.target.value }))}
                        disabled={busy}
                        placeholder="Descripción breve..."
                        rows={4}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Archivo PDF *</span>

                      <label className={styles.fileBox}>
                        <input
                          className={styles.fileInput}
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={busy}
                          onChange={(e) =>
                            setCreate((p) => ({
                              ...p,
                              file: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <span className={styles.fileButton}>Seleccionar archivo</span>
                        <span className={styles.fileName}>
                          {create.file ? create.file.name : "Ningún archivo seleccionado"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={busy}
                    >
                      Cancelar
                    </button>

                    <button type="submit" className={styles.btnSave} disabled={busy}>
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </form>
            ) : !selected ? (
              <div className={styles.helper}>Selecciona una póliza de la tabla para ver detalles.</div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSaveEdit();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailCard}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Código de póliza <span className={styles.required}>*</span>
                      </span>
                      <input
                        className={styles.floatingInput}
                        value={edit.policyCode}
                        onChange={(e) => setEdit((p) => ({ ...p, policyCode: e.target.value }))}
                        disabled={busy}
                        placeholder="Código..."
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={edit.description}
                        onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                        disabled={busy}
                        placeholder="Descripción..."
                        rows={4}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Reemplazar PDF</span>

                      <label className={styles.fileBox}>
                        <input
                          className={styles.fileInput}
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={busy}
                          onChange={(e) =>
                            setEdit((p) => ({
                              ...p,
                              file: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <span className={styles.fileButton}>Seleccionar archivo</span>
                        <span className={styles.fileName}>
                          {edit.file ? edit.file.name : "Sin cambios en el archivo"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={busy}
                    >
                      Cancelar
                    </button>

                    <button type="submit" className={styles.btnSave} disabled={busy}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className={styles.detailBox}>
                <div className={styles.detailCard}>
                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Código</span>
                    <div className={styles.floatingValue}>{getPolicyCode(selected) ?? "—"}</div>
                  </div>

                  <div className={styles.floatingFieldArea}>
                    <span className={styles.floatingLabel}>Descripción</span>
                    <div className={styles.floatingValueArea}>
                      {getDescription(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Archivo</span>
                    <button
                      type="button"
                      className={styles.btnMini}
                      onClick={() => void onDownload(selected)}
                      disabled={busy}
                    >
                      Descargar PDF
                    </button>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button className={styles.btnGhost} type="button" onClick={clearSelection} disabled={busy}>
                    Cerrar
                  </button>

                  <button
                    className={styles.btnDanger}
                    type="button"
                    onClick={openDeleteModal}
                    disabled={busy}
                  >
                    Eliminar
                  </button>

                  <button className={styles.btnEdit} type="button" onClick={startEdit} disabled={busy}>
                    Editar
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {deleteModalOpen && selected && (
        <div
          className={styles.deleteConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          onClick={closeDeleteModal}
        >
          <div
            className={styles.deleteConfirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteConfirmHeader}>
              <div className={styles.deleteConfirmIcon}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12M10 11v6M14 11v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className={styles.deleteConfirmHeaderText}>
                <div className={styles.deleteConfirmTitle}>Confirmar eliminación</div>
                <div className={styles.deleteConfirmSubtitle}>
                  Esta acción eliminará la póliza seleccionada.
                </div>
              </div>
            </div>

            <div className={styles.deleteConfirmBody}>
              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Código</div>
                <div
                  className={styles.deleteFileName}
                  title={getPolicyCode(selected) ?? ""}
                >
                  {getPolicyCode(selected) ?? "—"}
                </div>
              </div>

              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Descripción</div>
                <div
                  className={styles.deleteFileName}
                  title={getDescription(selected) ?? ""}
                >
                  {getDescription(selected) ?? "—"}
                </div>
              </div>

              <div className={styles.deleteFormField}>
                <label className={styles.deleteFieldLabel}>Contraseña</label>
                <input
                  type="password"
                  className={styles.deleteInput}
                  value={deleteForm.password}
                  onChange={(e) => setDeleteForm({ password: e.target.value })}
                  placeholder="Ingresa tu contraseña"
                  disabled={deleting}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !deleting && deleteForm.password.trim()) {
                      void onDelete();
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
                className={styles.btnGhost}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.deleteConfirmBtn}
                onClick={() => void onDelete()}
                disabled={deleting || !deleteForm.password.trim()}
              >
                {deleting ? "Eliminando..." : "Eliminar póliza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePolicies(payload: unknown): PaymentPolicyRow[] {
  if (Array.isArray(payload)) return payload as PaymentPolicyRow[];

  const p = (payload ?? {}) as Record<string, unknown>;

  const items =
    (p.items as PaymentPolicyRow[]) ??
    (p.Items as PaymentPolicyRow[]) ??
    (p.data as PaymentPolicyRow[]) ??
    (p.Data as PaymentPolicyRow[]) ??
    (p.paymentPolicies as PaymentPolicyRow[]) ??
    (p.PaymentPolicies as PaymentPolicyRow[]) ??
    [];

  return Array.isArray(items) ? items : [];
}

function getId(d: PaymentPolicyRow | null): number | null {
  if (!d) return null;
  const v = d.idPaymentPolicy ?? d.IdPaymentPolicy ?? d.id ?? d.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getPolicyCode(d: PaymentPolicyRow | null): string | null {
  if (!d) return null;
  const s = String(d.policyCode ?? d.PolicyCode ?? "").trim();
  return s ? s : null;
}

function getDescription(d: PaymentPolicyRow | null): string | null {
  if (!d) return null;
  const s = String(d.description ?? d.Description ?? "").trim();
  return s ? s : null;
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

function authFormHeaders(): HeadersInit {
  const headers = authHeaders();

  if (headers instanceof Headers) {
    const authorization = headers.get("Authorization");
    return authorization ? { Authorization: authorization } : {};
  }

  if (Array.isArray(headers)) {
    const authorization = headers.find(([key]) => key.toLowerCase() === "authorization")?.[1];
    return authorization ? { Authorization: authorization } : {};
  }

  const recordHeaders = headers as Record<string, string | undefined>;
  const authorization = recordHeaders.Authorization ?? recordHeaders.authorization;

  return authorization ? { Authorization: authorization } : {};
}

function extractFileName(disposition: string | null): string | null {
  if (!disposition) return null;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

  const basicMatch = disposition.match(/filename="([^"]+)"/i);
  if (basicMatch?.[1]) return basicMatch[1];

  return null;
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    return text;
  } catch {
    return "";
  }
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error inesperado.";
  }
}