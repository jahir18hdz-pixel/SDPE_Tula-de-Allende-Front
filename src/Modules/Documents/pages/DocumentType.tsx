import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/DocumentType.module.css";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type DocumentTypeRow = {
  idDocumentType?: number;
  IdDocumentType?: number;
  id?: number;
  Id?: number;

  documentName?: string;
  DocumentName?: string;
  name?: string;
  Name?: string;

  description?: string;
  Description?: string;

  active?: boolean | number | string;
  Active?: boolean | number | string;

  [key: string]: unknown;
};

type PagedLike = {
  items?: DocumentTypeRow[];
  Items?: DocumentTypeRow[];
  data?: DocumentTypeRow[];
  Data?: DocumentTypeRow[];
  documentTypes?: DocumentTypeRow[];
  DocumentTypes?: DocumentTypeRow[];
  totalCount?: number;
  TotalCount?: number;
  total?: number;
  Total?: number;
  pageNumber?: number;
  PageNumber?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
};

type CreateForm = {
  documentName: string;
  description: string;
  active: boolean;
};

type EditForm = {
  idDocumentType: string;
  documentName: string;
  description: string;
  active: boolean;
};

const DOC_BASE = "/api/DocumentType";

const initialCreate: CreateForm = {
  documentName: "",
  description: "",
  active: true,
};

export default function DocumentType() {
  const [rows, setRows] = useState<DocumentTypeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<DocumentTypeRow | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [create, setCreate] = useState<CreateForm>(initialCreate);
  const [edit, setEdit] = useState<EditForm>({
    idDocumentType: "",
    documentName: "",
    description: "",
    active: true,
  });

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

  function normalizePaged(payload: unknown): {
    items: DocumentTypeRow[];
    totalCount: number | null;
    page: number | null;
    pageSize: number | null;
  } {
    if (Array.isArray(payload)) {
      return {
        items: payload as DocumentTypeRow[],
        totalCount: null,
        page: null,
        pageSize: null,
      };
    }

    const p = (payload ?? {}) as PagedLike;

    const items = (p.items ??
      p.Items ??
      p.data ??
      p.Data ??
      p.documentTypes ??
      p.DocumentTypes ??
      []) as DocumentTypeRow[];

    const totalCount =
      (p.totalCount ?? p.TotalCount ?? p.total ?? p.Total) != null
        ? Number(p.totalCount ?? p.TotalCount ?? p.total ?? p.Total)
        : null;

    const page =
      (p.pageNumber ?? p.PageNumber ?? p.page ?? p.Page) != null
        ? Number(p.pageNumber ?? p.PageNumber ?? p.page ?? p.Page)
        : null;

    const pageSize =
      (p.pageSize ?? p.PageSize) != null
        ? Number(p.pageSize ?? p.PageSize)
        : null;

    return { items, totalCount, page, pageSize };
  }

  const loadPaged = useCallback(
    async (nextPage: number, nextPageSize: number) => {
      setLoading(true);
      try {
        const result = await requestJson(
          `${DOC_BASE}/paged?pageNumber=${nextPage}&pageSize=${nextPageSize}`,
          { method: "GET", headers: authHeaders() },
        );

        if (!result.ok) {
          showToast("error", result.error);
          setRows([]);
          setTotalCount(null);
          return;
        }

        const norm = normalizePaged(result.data);
        setRows(norm.items);
        setTotalCount(norm.totalCount);

        setPage(norm.page ?? nextPage);
        setPageSize(norm.pageSize ?? nextPageSize);

        const keepId = selectedIdRef.current;
        if (keepId != null) {
          const found = norm.items.find((d) => getId(d) === keepId) ?? null;
          setSelected(found);

          if (found && modeRef.current === "edit") {
            setEdit({
              idDocumentType: String(getId(found) ?? ""),
              documentName: getName(found) ?? "",
              description: getDescription(found) ?? "",
              active: getActive(found) ?? true,
            });
          }
        }
      } catch (e: unknown) {
        showToast("error", toErrorMessage(e));
        setRows([]);
        setTotalCount(null);
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadPaged(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedRows = useMemo(() => {
    const only = rows.filter((d) => {
      const active = getActive(d) ?? false;
      return showInactive ? !active : active;
    });

    const q = search.trim().toLowerCase();
    if (!q) return only;

    return only.filter((d) => {
      const name = (getName(d) ?? "").toLowerCase();
      const desc = (getDescription(d) ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [rows, search, showInactive]);

  function onRowClick(row: DocumentTypeRow) {
    setSelected(row);
    setMode("view");
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setCreate(initialCreate);
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
  }

  function startEdit() {
    if (!selected) return;

    setEdit({
      idDocumentType: String(getId(selected) ?? ""),
      documentName: getName(selected) ?? "",
      description: getDescription(selected) ?? "",
      active: getActive(selected) ?? true,
    });

    setMode("edit");
  }

  function toggleViewActiveInactive() {
    setShowInactive((prev) => !prev);
    setSelected(null);
    setMode("view");
    setSearch("");
  }

  function validateCreate(): string {
    const name = create.documentName.trim();
    const desc = create.description.trim();

    if (!name) return "El nombre del documento es obligatorio.";
    if (name.length < 2) return "Nombre demasiado corto.";
    if (!desc) return "La descripción es obligatoria.";

    return "";
  }

  async function onCreate() {
    const msg = validateCreate();
    if (msg) {
      showToast("error", msg);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        idDocumentType: 0,
        documentName: create.documentName.trim(),
        description: create.description.trim(),
        active: create.active,
      };

      const result = await requestJson(DOC_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      showToast("success", "Tipo de documento creado");
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
    const id = Number(edit.idDocumentType);
    if (!Number.isFinite(id) || id <= 0) return "Id inválido.";

    const name = edit.documentName.trim();
    const desc = edit.description.trim();

    if (!name) return "El nombre del documento es obligatorio.";
    if (!desc) return "La descripción es obligatoria.";

    return "";
  }

  async function onSaveEdit() {
    if (!selected) return;

    const msg = validateEdit();
    if (msg) {
      showToast("error", msg);
      return;
    }

    setSaving(true);
    try {
      const id = Number(edit.idDocumentType);

      const payload = {
        idDocumentType: id,
        documentName: edit.documentName.trim(),
        description: edit.description.trim(),
        active: edit.active,
      };

      const result = await requestJson(`${DOC_BASE}/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      showToast("success", "Tipo actualizado");
      setMode("view");
      setSelected(null);
      await loadPaged(page, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const totalPages = useMemo(() => {
    if (totalCount == null) return null;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  const formDisabled = saving || loading;

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
            <h1 className={styles.h1}>Tipos de documento</h1>
            <p className={styles.sub}>
              {showInactive
                ? "Viendo tipos inactivos."
                : "Viendo tipos activos."}
            </p>
          </div>

          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Buscar por nombre o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={formDisabled}
            />

            {search.trim() !== "" && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                type="button"
                aria-label="Limpiar búsqueda"
                disabled={formDisabled}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={toggleViewActiveInactive}
              disabled={
                saving || loading || mode === "create" || mode === "edit"
              }
              title="Cambiar vista activos/inactivos"
            >
              {showInactive ? "Ver activos" : "Ver inactivos"}
            </button>

            <button
              className={styles.btnPrimary}
              onClick={startCreate}
              disabled={saving || mode === "create"}
              type="button"
            >
              {mode === "create" ? "Creando..." : "+ Nuevo"}
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
                disabled={formDisabled}
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
                  disabled={formDisabled || page <= 1}
                  onClick={() =>
                    void loadPaged(Math.max(1, page - 1), pageSize)
                  }
                >
                  Anterior
                </button>

                <span className={styles.pagerInfo}>
                  {page}
                  {totalPages ? ` / ${totalPages}` : ""}
                </span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={
                    formDisabled ||
                    (totalPages != null
                      ? page >= totalPages
                      : rows.length < pageSize)
                  }
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
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando tipos de documento...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {search.trim()
                        ? "No se encontraron registros con esos criterios."
                        : showInactive
                          ? "No hay tipos inactivos."
                          : "No hay tipos activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((d, idx) => {
                    const id = getId(d);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected =
                      selectedId != null && id != null && id === selectedId;
                    const active = getActive(d) ?? false;
                    const fullDescription = getDescription(d);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(d)}
                      >
                        <td className={styles.mono}>{getName(d) ?? "—"}</td>
                        <td title={fullDescription ?? ""}>
                          {limitWords(fullDescription, 10) ?? "—"}
                        </td>
                        <td>
                          <Switch
                            checked={active}
                            disabled
                            label={active ? "Activo" : "Inactivo"}
                          />
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
              {mode === "create"
                ? "Nuevo tipo"
                : mode === "edit"
                  ? "Editar tipo"
                  : "Detalle"}
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
                      <span className={styles.floatingLabel}>Nombre</span>
                      <textarea
                        className={styles.floatingTextareaSingle}
                        value={create.documentName}
                        onChange={(e) =>
                          setCreate((p) => ({
                            ...p,
                            documentName: normalizeTextInput(e.target.value),
                          }))
                        }
                        onBlur={(e) =>
                          setCreate((p) => ({
                            ...p,
                            documentName: normalizeTextInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Escribe el nombre..."
                        rows={2}
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={create.description}
                        onChange={(e) =>
                          setCreate((p) => ({
                            ...p,
                            description: normalizeTextInput(e.target.value),
                          }))
                        }
                        onBlur={(e) =>
                          setCreate((p) => ({
                            ...p,
                            description: breakTextEvery12Words(
                              normalizeTextInput(e.target.value),
                            ),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Escribe la descripción..."
                        rows={4}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={create.active}
                        disabled={formDisabled}
                        label={create.active ? "Activo" : "Inactivo"}
                        onChange={(next) =>
                          setCreate((p) => ({ ...p, active: next }))
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={saving}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className={styles.btnSave}
                      disabled={formDisabled}
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </form>
            ) : !selected ? (
              <div className={styles.helper}>
                Selecciona un tipo de documento de la tabla para ver detalles.
              </div>
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
                      <span className={styles.floatingLabel}>Nombre</span>
                      <textarea
                        className={styles.floatingTextareaSingle}
                        value={edit.documentName}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            documentName: normalizeTextInput(e.target.value),
                          }))
                        }
                        onBlur={(e) =>
                          setEdit((p) => ({
                            ...p,
                            documentName: normalizeTextInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Escribe el nombre..."
                        rows={2}
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={edit.description}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            description: normalizeTextInput(e.target.value),
                          }))
                        }
                        onBlur={(e) =>
                          setEdit((p) => ({
                            ...p,
                            description: breakTextEvery12Words(
                              normalizeTextInput(e.target.value),
                            ),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Escribe la descripción..."
                        rows={4}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={edit.active}
                        disabled={formDisabled}
                        label={edit.active ? "Activo" : "Inactivo"}
                        onChange={(next) =>
                          setEdit((p) => ({ ...p, active: next }))
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={saving}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className={styles.btnSave}
                      disabled={formDisabled}
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className={styles.detailBox}>
                <div className={styles.detailCard}>
                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Nombre</span>
                    <div className={styles.floatingValue}>
                      {getName(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.floatingFieldArea}>
                    <span className={styles.floatingLabel}>Descripción</span>
                    <div className={styles.floatingValueArea}>
                      {getDescription(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Activo</span>
                    <Switch
                      checked={getActive(selected) ?? false}
                      disabled
                      label={
                        (getActive(selected) ?? false) ? "Activo" : "Inactivo"
                      }
                    />
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.btnGhost}
                    type="button"
                    onClick={clearSelection}
                    disabled={saving}
                  >
                    Cerrar
                  </button>

                  <button
                    className={styles.btnEdit}
                    type="button"
                    onClick={startEdit}
                    disabled={formDisabled}
                  >
                    Editar
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Switch */
type SwitchProps = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <label className={styles.switchWrap} aria-disabled={disabled}>
      {label && <span className={styles.switchLabel}>{label}</span>}
      <button
        type="button"
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => !disabled && onChange?.(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={label ?? "Estado"}
      >
        <span className={styles.switchKnob} />
      </button>
    </label>
  );
}

/** Helpers */
function getId(d: DocumentTypeRow | null): number | null {
  if (!d) return null;
  const v = d.idDocumentType ?? d.IdDocumentType ?? d.id ?? d.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getName(d: DocumentTypeRow | null): string | null {
  if (!d) return null;
  const s = String(
    d.documentName ?? d.DocumentName ?? d.name ?? d.Name ?? "",
  ).trim();
  return s ? s : null;
}

function getDescription(d: DocumentTypeRow | null): string | null {
  if (!d) return null;
  const s = String(d.description ?? d.Description ?? "").trim();
  return s ? s : null;
}

function getActive(d: DocumentTypeRow | null): boolean | null {
  if (!d) return null;
  const v = d.active ?? d.Active;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }

  return null;
}

function normalizeTextInput(value: string): string {
  const cleanValue = value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");

  if (!cleanValue) return "";

  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
}

function breakTextEvery12Words(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (let i = 0; i < words.length; i += 12) {
    lines.push(words.slice(i, i + 12).join(" "));
  }

  return lines.join("\n");
}

function limitWords(text: string | null, maxWords: number): string | null {
  if (!text) return null;

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;

  return `${words.slice(0, maxWords).join(" ")}...`;
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