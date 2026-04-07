import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../styles/Roles.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson } from "../../../services/api";

type Role = {
  idRol?: number;
  IdRol?: number;
  id?: number;
  Id?: number;

  rolName?: string;
  RolName?: string;
  roleName?: string;
  RoleName?: string;
  name?: string;
  Name?: string;

  description?: string;
  Description?: string;
  descripcion?: string;
  Descripcion?: string;

  active?: boolean | number | string;
  Active?: boolean | number | string;
  isActive?: boolean | number | string;
  IsActive?: boolean | number | string;

  [key: string]: unknown;
};

type FormDto = {
  name: string;
  description: string;
  active: boolean;
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = "/api/Role";

const initialForm: FormDto = {
  name: "",
  description: "",
  active: true,
};

export default function Roles() {
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Role | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [create, setCreate] = useState<FormDto>(initialForm);
  const [edit, setEdit] = useState<FormDto>(initialForm);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const selectedId = useMemo(() => getId(selected), [selected]);
  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function extractList(payload: unknown): Role[] {
    if (Array.isArray(payload)) return payload as Role[];

    if (isRecord(payload) && Array.isArray(payload.$values)) {
      return payload.$values as Role[];
    }

    const obj = asObject(payload);
    if (!obj) return [];

    const possible =
      obj.items ??
      obj.Items ??
      obj.data ??
      obj.Data ??
      obj.roles ??
      obj.Roles ??
      obj.values ??
      obj.Values ??
      obj.result ??
      obj.Result;

    if (Array.isArray(possible)) return possible as Role[];

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as Role[];

    if (isRecord(payload)) return [payload as Role];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const keys = [
      "$values",
      "data",
      "Data",
      "items",
      "Items",
      "result",
      "Result",
      "values",
      "Values",
      "roles",
      "Roles",
      "value",
      "Value",
    ];

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
      const nested = findArrayDeep(value, depth + 1);
      if (nested) return nested;
    }

    return null;
  }

  function nameExists(name: string, ignoreId?: number | null): boolean {
    const normalized = asTrim(name).toLowerCase();
    if (!normalized) return false;

    return rows.some((r) => {
      const currentId = getId(r);
      const currentName = (getName(r) ?? "").trim().toLowerCase();

      if (ignoreId != null && currentId === ignoreId) return false;
      return currentName === normalized;
    });
  }

  async function loadAll() {
    setLoading(true);
    try {
      const result = await requestJson(API_BASE, {
        method: "GET",
      });

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const list = extractList(result.data);
      setRows(list);

      if (selectedId != null) {
        const found = list.find((r) => getId(r) === selectedId) ?? null;
        setSelected(found);

        if (found && modeRef.current === "edit") {
          setEdit({
            name: String(getName(found) ?? ""),
            description: String(getDescription(found) ?? ""),
            active: getActive(found) ?? true,
          });
        }
      }
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = asTrim(search).toLowerCase();

    const base = q
      ? rows
      : rows.filter((r) => {
          const active = getActive(r) ?? false;
          return showInactive ? !active : active;
        });

    if (!q) return base;

    return base.filter((r) => {
      const name = String(getName(r) ?? "").toLowerCase();
      const desc = String(getDescription(r) ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [rows, search, showInactive]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const displayedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  function onRowClick(row: Role) {
    setSelected(row);
    setMode("view");
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setCreate(initialForm);
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
  }

  function startEdit() {
    if (!selected) return;

    setEdit({
      name: String(getName(selected) ?? ""),
      description: String(getDescription(selected) ?? ""),
      active: getActive(selected) ?? true,
    });
    setMode("edit");
  }

  function toggleViewActiveInactive() {
    setShowInactive((prev) => !prev);
    setSelected(null);
    setMode("view");
    setPage(1);
  }

  function validateForm(f: FormDto, isCreate: boolean): string {
    const name = asTrim(f.name);
    const desc = asTrim(f.description);

    if (!name) return "El nombre del rol es obligatorio.";
    if (name.length < 3) return "El nombre del rol es muy corto.";

    if (isCreate && nameExists(name)) {
      return "No se pueden repetir los nombres de rol.";
    }

    if (!isCreate && nameExists(name, selectedId)) {
      return "No se pueden repetir los nombres de rol.";
    }

    if (!desc) return "La descripción es obligatoria.";
    if (desc.length < 3) return "La descripción es muy corta.";

    return "";
  }

  async function onCreate() {
    const msg = validateForm(create, true);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        RolName: asTrim(create.name),
        Description: asTrim(create.description),
        Active: Boolean(create.active),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol creado correctamente");
      setMode("view");
      setCreate(initialForm);
      await loadAll();
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit() {
    const id = selectedId;
    if (id == null || id <= 0) {
      return showToast("error", "No pude identificar el rol seleccionado.");
    }

    const msg = validateForm(edit, false);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        IdRol: id,
        RolName: asTrim(edit.name),
        Description: asTrim(edit.description),
        Active: Boolean(edit.active),
      };

      const result = await requestJson(API_BASE, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol actualizado correctamente");
      setMode("view");
      setSelected(null);
      await loadAll();
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

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
            <h1 className={styles.h1}>Roles</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                  ? "Viendo roles inactivos."
                  : "Viendo roles activos."}
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

            {asTrim(search) !== "" && (
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
                  setPageSize(ps);
                  setPage(1);
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>

                <span className={styles.pagerInfo}>
                  {page} / {totalPages}
                </span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={formDisabled || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
                  <th style={{ width: 220 }}>Nombre</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando roles...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron roles (activos o inactivos) con esos criterios."
                        : showInactive
                          ? "No hay roles inactivos."
                          : "No hay roles activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const id = getId(r);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected =
                      selectedId != null && id != null && id === selectedId;

                    const active = getActive(r) ?? false;
                    const fullDescription = getDescription(r);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td title={getName(r) ?? ""}>{getName(r) ?? "—"}</td>
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
                ? "Nuevo rol"
                : mode === "edit"
                  ? "Editar rol"
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
                      <input
                        className={styles.floatingInput}
                        value={create.name}
                        onChange={(e) =>
                          setCreate((p) => ({
                            ...p,
                            name: normalizeTextInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Nombre del rol"
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
                        disabled={formDisabled}
                        placeholder="Descripción del rol"
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
                Selecciona un rol de la tabla para ver detalles.
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
                      <input
                        className={styles.floatingInput}
                        value={edit.name}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            name: normalizeTextInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Nombre"
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
                        disabled={formDisabled}
                        placeholder="Descripción"
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
                      disabled={saving}
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
                    disabled={saving || loading}
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
function getId(r: Role | null): number | null {
  if (!r) return null;
  const v = r.idRol ?? r.IdRol ?? r.id ?? r.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getName(r: Role | null): string | null {
  if (!r) return null;
  const v =
    r.rolName ?? r.RolName ?? r.roleName ?? r.RoleName ?? r.name ?? r.Name;
  const s = asTrim(v ?? "");
  return s ? s : null;
}

function getDescription(r: Role | null): string | null {
  if (!r) return null;
  const v = r.description ?? r.Description ?? r.descripcion ?? r.Descripcion;
  const s = asTrim(v ?? "");
  return s ? s : null;
}

function getActive(r: Role | null): boolean | null {
  if (!r) return null;

  const v: unknown = r.active ?? r.Active ?? r.isActive ?? r.IsActive;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (typeof v === "string") {
    const t = asTrim(v).toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }

  return null;
}


function asString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function asTrim(v: unknown): string {
  return asString(v).trim();
}

function normalizeTextInput(value: string): string {
  const noLeadingSpaces = value.replace(/^\s+/, "");

  if (!noLeadingSpaces) return "";

  return noLeadingSpaces.charAt(0).toUpperCase() + noLeadingSpaces.slice(1);
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asObject(v: unknown): UnknownRecord | null {
  return isRecord(v) ? (v as UnknownRecord) : null;
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