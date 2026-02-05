import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Roles.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ConfirmDialog from "../../../Components/layout/ConfirmDialog";

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

type AuthStored = {
  token?: string;
  Token?: string;
};

type UnknownRecord = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const API_BASE = `${BASE_API}/api/Role`;

export default function Roles() {
  const [rows, setRows] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Role | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [form, setForm] = useState<FormDto>({
    name: "",
    description: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ buscador
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // ✅ paginación (igual que Users)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // ✅ al cambiar búsqueda, vuelve a página 1 (como UX típica)
  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || isSearching) return rows;

    const maybeNum = Number(q);
    const isNum = Number.isFinite(maybeNum) && q !== "";

    if (isNum) {
      return rows.filter((r) => String(getId(r) ?? "").includes(q));
    }

    return rows.filter((r) => {
      const name = (getName(r) ?? "").toLowerCase();
      const desc = (getDescription(r) ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [rows, search, isSearching]);

  // ✅ total/páginas + slice
  const totalCount = useMemo(() => filteredRows.length, [filteredRows]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  const displayedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // ✅ si reduces pageSize o cambian filas y tu page queda fuera, corrige
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function readToken(): string {
    const rawAuth = localStorage.getItem("auth");
    if (rawAuth) {
      try {
        const parsed = JSON.parse(rawAuth) as AuthStored;
        const token = (parsed.token ?? parsed.Token ?? "").trim();
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
    const res = await fetch(url, {
      ...init,
      credentials: "omit",
    });

    if (res.status === 204) return { ok: true, data: [], status: 204 };

    const text = await safeText(res);
    const parsed = tryParseJson(text);

    if (!res.ok) {
      const apiMsg =
        isRecord(parsed) && typeof parsed.message === "string" ? parsed.message : "";
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
    if (isRecord(payload) && Array.isArray(payload.$values)) {
      return payload.$values as Role[];
    }
    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as Role[];
    if (isRecord(payload)) return [payload as Role];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const values = payload["$values"];
    if (Array.isArray(values)) return values;

    const keys = ["data", "result", "items", "value", "values"];
    for (const k of keys) {
      const v = payload[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function nameExists(name: string): boolean {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return rows.some((r) => (getName(r) ?? "").trim().toLowerCase() === n);
  }

  async function loadAll(keepSelected?: number | null) {
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

      // ✅ al recargar data, vuelve a la página 1 (evita quedarte en página vacía)
      setPage(1);

      if (keepSelected != null) {
        const found = list.find((r) => getId(r) === keepSelected) ?? null;
        setSelected(found);
        setMode("view");
      }
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }

  async function searchById(id: number) {
    setIsSearching(true);
    setLoading(true);
    try {
      const result = await requestJson(`${API_BASE}/${id}`, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!result.ok) {
        if (result.status === 404) {
          showToast("error", `No se encontró el rol con id ${id}.`);
          setRows([]);
          setSelected(null);
          setMode("view");
          return;
        }
        showToast("error", result.error);
        return;
      }

      const role = extractList(result.data);
      setRows(role);
      setPage(1);

      const found = role[0] ?? null;
      setSelected(found);
      setMode("view");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }

  async function searchByName(name: string) {
    setIsSearching(true);
    setLoading(true);
    try {
      const result = await requestJson(`${API_BASE}/by-name/${encodeURIComponent(name)}`, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!result.ok) {
        if (result.status === 404) {
          showToast("error", `No se encontró el rol "${name}".`);
          setRows([]);
          setSelected(null);
          setMode("view");
          return;
        }
        showToast("error", result.error);
        return;
      }

      const role = extractList(result.data);
      setRows(role);
      setPage(1);

      const found = role[0] ?? null;
      setSelected(found);
      setMode("view");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }

  async function onSearch() {
    const q = search.trim();
    if (!q) {
      await loadAll();
      return;
    }

    const num = Number(q);
    const isNum = Number.isFinite(num) && q !== "";

    if (isNum) {
      await searchById(num);
      return;
    }

    await searchByName(q);
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
    setForm({ name: "", description: "", active: true });
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setForm({ name: "", description: "", active: true });
  }

  function startEdit(row: Role) {
    setMode("edit");
    setSelected(row);
    setForm({
      name: String(getName(row) ?? ""),
      description: String(getDescription(row) ?? ""),
      active: getActive(row) ?? true,
    });
  }

  function onRowClick(row: Role) {
    setSelected(row);
    setMode("view");
  }

  function validateForm(): string {
    const name = form.name.trim();
    const desc = form.description.trim();

    if (!name) return "El nombre del rol es obligatorio.";
    if (name.length < 3) return "El nombre del rol es muy corto.";

    if (mode === "create" && nameExists(name)) {
      return "No se pueden repetir los nombres de rol.";
    }

    if (!desc) return "La descripción es obligatoria.";
    if (desc.length < 3) return "La descripción es muy corta.";

    return "";
  }

  async function onCreate() {
    const msg = validateForm();
    if (msg) return showToast("error", msg);

    if (nameExists(form.name)) {
      return showToast("error", "Nombre duplicado. No se pueden repetir roles.");
    }

    setSaving(true);
    try {
      const payload = {
        RolName: form.name.trim(),
        Description: form.description.trim(),
        active: form.active,
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol creado correctamente");
      setMode("view");
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected || selectedId == null) {
      return showToast("error", "Selecciona un rol para editar.");
    }

    const msg = validateForm();
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        IdRol: selectedId,
        RolName: form.name.trim(),
        Description: form.description.trim(),
        active: form.active,
      };

      const result = await requestJson(API_BASE, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol actualizado correctamente");
      setMode("view");
      await loadAll(selectedId);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirmed() {
    if (!selected || selectedId == null) {
      setConfirmOpen(false);
      return showToast("error", "Selecciona un rol para eliminar.");
    }

    setSaving(true);
    try {
      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Rol desactivado correctamente");
      setMode("view");
      setSelected(null);
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className={styles.page}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Desactivar rol"
        message={`¿Estás seguro de desactivar el rol "${getName(selected) ?? "—"}" (id ${
          selectedId ?? "—"
        })? Esta acción no se puede deshacer.`}
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onDeleteConfirmed}
      />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Roles</h1>
            <p className={styles.sub}>Consulta, crea, edita o desactiva roles.</p>
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
              placeholder="Buscar por id o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={saving || loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSearch();
                }
              }}
            />

            {search.trim() !== "" && (
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

          <button className={styles.btnPrimary} onClick={startCreate} disabled={saving || mode === "create"} type="button">
            {mode === "create" ? "Creando..." : "+ Nueva"}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Listado</p>

            {/* ✅ PAGER igual que Users */}
            <div className={styles.pager}>
              <select
                className={styles.pageSize}
                value={pageSize}
                disabled={loading || saving}
                onChange={(e) => setPageSize(Number(e.target.value))}
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
                  <th style={{ width: 140 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando roles...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {search.trim() ? "No se encontraron roles con esos criterios." : "No hay roles registrados."}
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>No hay registros en esta página.</td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const id = getId(r);
                    const name = getName(r) ?? "—";
                    const active = getActive(r);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected = selectedId != null && id != null && id === selectedId;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>{id != null ? String(id) : "—"}</td>
                        <td>{name}</td>
                        <td>
                          <Switch checked={active ?? false} disabled />
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
              {mode === "create" ? "Nuevo rol" : mode === "edit" ? "Editar rol" : "Detalle"}
            </p>
          </div>

          <div className={styles.panelBody}>
            {mode === "view" ? (
              !selected ? (
                <div className={styles.helper}>Selecciona un rol de la tabla para ver detalles o editar.</div>
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
                    <Switch checked={getActive(selected) ?? false} disabled />
                  </div>

                  <div className={styles.actions}>
                    <button className={styles.btnGhost} type="button" onClick={clearSelection} disabled={saving}>
                      Cancelar
                    </button>

                    <button className={styles.btnEdit} type="button" onClick={() => startEdit(selected)} disabled={saving}>
                      Editar
                    </button>

                    <button className={styles.btnDanger} type="button" onClick={() => setConfirmOpen(true)} disabled={saving}>
                      Desactivar
                    </button>
                  </div>
                </div>
              )
            ) : (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mode === "create") void onCreate();
                  else void onUpdate();
                }}
              >
                <div className={styles.grid}>
                  <Field label="Nombre" required>
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Activo">
                    <div className={styles.switchField}>
                      <Switch
                        checked={form.active}
                        disabled={saving}
                        onChange={(next) => setForm((p) => ({ ...p, active: next }))}
                        label={form.active ? "Activo" : "Inactivo"}
                      />
                    </div>
                  </Field>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.btnGhost} onClick={clearSelection} disabled={saving}>
                    Cancelar
                  </button>

                  <button type="submit" className={styles.btnSave} disabled={saving}>
                    {saving ? "Guardando..." : mode === "create" ? "Crear rol" : "Guardar cambios"}
                  </button>
                </div>
              </form>
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
        aria-label={label ?? "Cambiar estado"}
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
  const v = r.rolName ?? r.RolName ?? r.roleName ?? r.RoleName ?? r.name ?? r.Name;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getDescription(r: Role | null): string | null {
  if (!r) return null;
  const v = r.description ?? r.Description ?? r.descripcion ?? r.Descripcion;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getActive(r: Role | null): boolean | null {
  if (!r) return null;

  const v: unknown = r.active ?? r.Active ?? r.isActive ?? r.IsActive;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }

  return null;
}

type FieldProps = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
};

function Field({ label, required = false, children }: FieldProps) {
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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  const t = (text ?? "").trim();
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
