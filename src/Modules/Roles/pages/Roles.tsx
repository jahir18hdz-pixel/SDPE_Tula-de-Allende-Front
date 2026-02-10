import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Roles.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

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

  active?: boolean;
  Active?: boolean;
  isActive?: boolean;
  IsActive?: boolean;

  [key: string]: unknown;
};

type FormDto = {
  name: string;
  description: string;
  active: boolean;
};

type AuthStored = { token?: string; Token?: string };
type UnknownRecord = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const API_BASE = `${BASE_API}/api/Role`;

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

  // paginación FRONT
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

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function readToken(): string {
    const rawAuth = localStorage.getItem("auth");
    if (rawAuth) {
      try {
        const parsed = JSON.parse(rawAuth) as AuthStored;
        const token = asTrim(parsed.token ?? parsed.Token);
        if (token) return token;
      } catch {
        // ignore
      }
    }
    return "";
  }

  function authHeaders(): HeadersInit {
    const token = readToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function requestJson(
    url: string,
    init?: RequestInit
  ): Promise<
    | { ok: true; data: unknown; status: number }
    | { ok: false; error: string; status: number }
  > {
    const res = await fetch(url, { ...init, credentials: "omit" });

    if (res.status === 204) return { ok: true, data: [], status: 204 };

    const text = await safeText(res);
    const parsed = tryParseJson(text);

    if (!res.ok) {
      const apiMsg =
        isRecord(parsed) && typeof (parsed as UnknownRecord).message === "string"
          ? String((parsed as UnknownRecord).message)
          : "";
      const msg =
        apiMsg ||
        (typeof parsed === "string" ? parsed : "") ||
        text ||
        `HTTP ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: parsed, status: res.status };
  }

  function extractList(payload: unknown): Role[] {
    if (Array.isArray(payload)) return payload as Role[];
    if (isRecord(payload) && Array.isArray((payload as UnknownRecord).$values)) {
      return (payload as UnknownRecord).$values as Role[];
    }
    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as Role[];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const obj = payload as UnknownRecord;

    const values = obj["$values"];
    if (Array.isArray(values)) return values;

    const keys = ["data", "result", "items", "value", "values"];
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function nameExists(name: string): boolean {
    const n = asTrim(name).toLowerCase();
    if (!n) return false;
    return rows.some((r) => (getName(r) ?? "").trim().toLowerCase() === n);
  }

  async function loadAll(keepSelectedId?: number | null) {
    setLoading(true);
    try {
      const token = readToken();
      if (!token) {
        showToast("error", "No hay token. Inicia sesión nuevamente.");
        setRows([]);
        return;
      }

      const result = await requestJson(API_BASE, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const list = extractList(result.data);
      setRows(list);

      if (keepSelectedId != null) {
        const found = list.find((r) => getId(r) === keepSelectedId) ?? null;
        setSelected(found);
        setMode("view");
        if (found && mode === "edit") {
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

  /**
   * ✅ FILTRO CORREGIDO (igual que Proyect)
   * - Sin búsqueda: respeta showInactive (vista activos/inactivos)
   * - Con búsqueda: busca en TODOS (activos + inactivos)
   */
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
      const id = String(getId(r) ?? "").toLowerCase();
      const name = String(getName(r) ?? "").toLowerCase();
      const desc = String(getDescription(r) ?? "").toLowerCase();
      return id.includes(q) || name.includes(q) || desc.includes(q);
    });
  }, [rows, search, showInactive]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
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

  // ✅ No borra el search
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
    if (isCreate && nameExists(name)) return "No se pueden repetir los nombres de rol.";

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
        active: Boolean(create.active),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol creado correctamente");
      setMode("view");
      setCreate(initialForm);
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit() {
    if (!selected || selectedId == null) {
      return showToast("error", "Selecciona un rol para editar.");
    }

    const msg = validateForm(edit, false);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        IdRol: selectedId,
        RolName: asTrim(edit.name),
        Description: asTrim(edit.description),
        active: Boolean(edit.active),
      };

      const result = await requestJson(API_BASE, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol actualizado correctamente");
      setMode("view");
      setSelected(null);
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const createDisabled = saving || loading;

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Buscar por id, nombre o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={saving || loading}
            />

            {asTrim(search) !== "" && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                type="button"
                aria-label="Limpiar búsqueda"
                disabled={saving || loading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* ✅ IMPORTANTE: este contenedor es el que usa el gap y responsive de Proyect */}
          <div className={styles.headerActions}>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={toggleViewActiveInactive}
              disabled={saving || loading || mode === "create" || mode === "edit"}
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
        {/* LISTADO */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Listado</p>

            <div className={styles.pager}>
              <select
                className={styles.pageSize}
                value={pageSize}
                disabled={loading || saving}
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
                  disabled={loading || saving || page <= 1}
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
                  disabled={loading || saving || page >= totalPages}
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
                  <th style={{ width: 110 }}>Id</th>
                  <th>Nombre</th>
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
                ) : pagedRows.length === 0 ? (
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
                  pagedRows.map((r, idx) => {
                    const id = getId(r);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected = selectedId != null && id != null && id === selectedId;
                    const active = getActive(r) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>{id != null ? String(id) : "—"}</td>
                        <td>{getName(r) ?? "—"}</td>
                        <td>
                          <Switch checked={active} disabled label={active ? "Activo" : "Inactivo"} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PANEL */}
        <aside className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>
              {mode === "create" ? "Nuevo rol" : mode === "edit" ? "Editar rol" : "Detalle"}
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
                <div className={styles.grid}>
                  <Field label="Nombre" required>
                    <input
                      className={styles.input}
                      value={create.name}
                      onChange={(e) => setCreate((p) => ({ ...p, name: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Nombre del rol"
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={create.description}
                      onChange={(e) => setCreate((p) => ({ ...p, description: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Descripción del rol"
                    />
                  </Field>

                  <Field label="Activo">
                    <Switch
                      checked={create.active}
                      disabled={createDisabled}
                      label={create.active ? "Activo" : "Inactivo"}
                      onChange={(next) => setCreate((p) => ({ ...p, active: next }))}
                    />
                  </Field>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.btnGhost} onClick={() => setMode("view")} disabled={saving}>
                    Cancelar
                  </button>

                  <button type="submit" className={styles.btnSave} disabled={createDisabled}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            ) : !selected ? (
              <div className={styles.helper}>Selecciona un rol de la tabla para ver detalles.</div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSaveEdit();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Id</span>
                    <span className={styles.mono}>{String(selectedId ?? "—")}</span>
                  </div>

                  <Field label="Nombre" required>
                    <input
                      className={styles.input}
                      value={edit.name}
                      onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                      disabled={saving || loading}
                      placeholder="Nombre"
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={edit.description}
                      onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                      disabled={saving || loading}
                      placeholder="Descripción"
                    />
                  </Field>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Activo</span>
                    <Switch
                      checked={edit.active}
                      disabled={saving || loading}
                      label={edit.active ? "Activo" : "Inactivo"}
                      onChange={(next) => setEdit((p) => ({ ...p, active: next }))}
                    />
                  </div>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.btnGhost} onClick={() => setMode("view")} disabled={saving}>
                    Cancelar
                  </button>

                  <button type="submit" className={styles.btnSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.detailBox}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Id</span>
                  <span className={styles.mono}>{String(selectedId ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Nombre</span>
                  <span className={styles.detailValue}>{String(getName(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Descripción</span>
                  <span className={styles.detailValue}>{String(getDescription(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Activo</span>
                  <Switch
                    checked={getActive(selected) ?? false}
                    disabled
                    label={(getActive(selected) ?? false) ? "Activo" : "Inactivo"}
                  />
                </div>

                <div className={styles.actions}>
                  <button className={styles.btnGhost} type="button" onClick={clearSelection} disabled={saving}>
                    Cerrar
                  </button>

                  <button className={styles.btnEdit} type="button" onClick={startEdit} disabled={saving || loading}>
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

/** Field */
function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={styles.labelRow}>
        <label className={styles.label}>{label}</label>
        {required && <span className={styles.required}>*</span>}
      </div>
      {children}
    </div>
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
  const v = r.rolName ?? r.RolName ?? r.roleName ?? r.RoleName ?? r.name ?? r.Name;
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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  const t = asTrim(text);
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return text;
  }
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
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
