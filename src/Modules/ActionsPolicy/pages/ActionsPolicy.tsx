import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/ActionsPolicy.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type ActionPolicyRow = {
  idActionPolicy?: number;
  IdActionPolicy?: number;

  code?: number;
  Code?: number;

  description?: string;
  Description?: string;

  active?: boolean;
  Active?: boolean;

  [key: string]: unknown;
};

type Form = {
  code: string;
  description: string;
  active: boolean;
};

type AuthStored = { token?: string; Token?: string };
type UnknownObject = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const API_BASE = `${BASE_API}/api/ActionsPolicy`;

const initialForm: Form = {
  code: "",
  description: "",
  active: true,
};

export default function ActionsPolicy() {
  const [rows, setRows] = useState<ActionPolicyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<ActionPolicyRow | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  // paginación FRONT
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [create, setCreate] = useState<Form>(initialForm);
  const [edit, setEdit] = useState<Form>(initialForm);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const selectedCode = useMemo(() => getCode(selected), [selected]);
  const selectedId = useMemo(() => getIdActionPolicy(selected), [selected]);

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
      const apiMsg = isRecord(parsed) ? getStringProp(parsed, "message") ?? "" : "";
      const msg =
        apiMsg ||
        (typeof parsed === "string" ? parsed : "") ||
        text ||
        `HTTP ${res.status}`;

      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: parsed, status: res.status };
  }

  async function loadAll() {
    setLoading(true);
    try {
      const token = readToken();
      if (!token) {
        showToast("error", "No hay token. Inicia sesión nuevamente.");
        setRows([]);
        return;
      }

      const result = await requestJson(`${API_BASE}`, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const normalized = normalizeArray(result.data);
      setRows(normalized);

      // mantener selección si existe
      if (selectedCode != null) {
        const found = normalized.find((r) => getCode(r) === selectedCode) ?? null;
        setSelected(found);

        if (found && mode === "edit") {
          setEdit({
            code: String(getCode(found) ?? ""),
            description: getDescription(found) ?? "",
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

  function normalizeArray(payload: unknown): ActionPolicyRow[] {
    if (Array.isArray(payload)) return payload as ActionPolicyRow[];

    const obj = asObject(payload);
    if (!obj) return [];

    const possible =
      obj.items ??
      obj.Items ??
      obj.data ??
      obj.Data ??
      obj.actionPolicies ??
      obj.ActionPolicies ??
      obj.actionsPolicies ??
      obj.ActionsPolicies;

    if (Array.isArray(possible)) return possible as ActionPolicyRow[];

    return [];
  }

  const filteredRows = useMemo(() => {
    const only = rows.filter((r) => {
      const active = getActive(r) ?? false;
      return showInactive ? !active : active;
    });

    const q = asTrim(search).toLowerCase();
    if (!q) return only;

    return only.filter((r) => {
      const code = String(getCode(r) ?? "").toLowerCase();
      const desc = asString(getDescription(r) ?? "").toLowerCase();
      return code.includes(q) || desc.includes(q);
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

  function onRowClick(row: ActionPolicyRow) {
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
      code: String(getCode(selected) ?? ""),
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
    setPage(1);
  }

  function validateForm(f: Form): string {
    const code = Number(f.code);
    if (!Number.isFinite(code) || code <= 0) return "El código debe ser un número mayor a 0.";

    const desc = asTrim(f.description);
    if (!desc) return "La descripción es obligatoria.";

    return "";
  }

  async function onCreate() {
    const msg = validateForm(create);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        code: Number(create.code),
        description: asTrim(create.description),
        active: Boolean(create.active),
      };

      const result = await requestJson(`${API_BASE}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Acción creada correctamente");
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
    const msg = validateForm(edit);
    if (msg) return showToast("error", msg);

    // ✅ Controller: PUT /api/ActionsPolicy/{id:int}
    const id = selectedId;
    if (id == null || id <= 0) {
      return showToast("error", "No pude identificar el idActionPolicy de la acción seleccionada.");
    }

    // el controller requiere Code en el body, así que lo mandamos sí o sí
    const codeNum = Number(edit.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0) return showToast("error", "Código inválido.");

    setSaving(true);
    try {
      const payload = {
        idActionPolicy: id, // opcional (tu controller lo fuerza desde URL, pero no estorba)
        code: codeNum,
        description: asTrim(edit.description),
        active: Boolean(edit.active),
      };

      const result = await requestJson(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Acción actualizada correctamente");
      setMode("view");
      setSelected(null);
      await loadAll();
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // ✅ Controller: PATCH /api/ActionsPolicy/{code:int}/active   body: boolean
  async function onChangeActive(nextActive: boolean) {
    if (!selected) return;

    const code = getCode(selected);
    if (code == null) return showToast("error", "No pude identificar el Code.");

    setSaving(true);
    try {
      const result = await requestJson(`${API_BASE}/${code}/active`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(nextActive),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", nextActive ? "Acción activada correctamente" : "Acción desactivada correctamente");
      setMode("view");
      setSelected(null);
      await loadAll();
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
            <h1 className={styles.h1}>Acciones de Póliza</h1>
            <p className={styles.sub}>
              {showInactive ? "Viendo acciones inactivas." : "Viendo acciones activas."}
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
              placeholder="Buscar por código o descripción…"
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

          <div className={styles.headerActions}>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={toggleViewActiveInactive}
              disabled={saving || loading || mode === "create" || mode === "edit"}
              title="Cambiar vista activos/inactivos"
            >
              {showInactive ? "Ver activas" : "Ver inactivas"}
            </button>

            <button className={styles.btnPrimary} onClick={startCreate} disabled={saving || mode === "create"} type="button">
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
                  <th style={{ width: 140 }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando acciones...
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron acciones con esos criterios."
                        : showInactive
                        ? "No hay acciones inactivas."
                        : "No hay acciones activas."}
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((c, idx) => {
                    const code = getCode(c);
                    const key = code != null ? String(code) : `row-${idx}`;
                    const isSelected = selectedCode != null && code != null && code === selectedCode;
                    const active = getActive(c) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(c)}
                      >
                        <td className={styles.mono}>{code ?? "—"}</td>
                        <td>{getDescription(c) ?? "—"}</td>
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
              {mode === "create" ? "Nueva Acción" : mode === "edit" ? "Editar Acción" : "Detalle"}
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
                  <Field label="Código" required>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={create.code}
                      onChange={(e) => setCreate((p) => ({ ...p, code: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Ej: 10"
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={create.description}
                      onChange={(e) => setCreate((p) => ({ ...p, description: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Descripción de la acción"
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
              <div className={styles.helper}>Selecciona una acción de la tabla para ver detalles.</div>
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
                    <span className={styles.detailLabel}>ID</span>
                    <span className={styles.detailValue}>{getIdActionPolicy(selected) ?? "—"}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Código</span>
                    <span className={styles.detailValue}>{getCode(selected) ?? "—"}</span>
                  </div>

                  {/* mantenemos code en estado para el PUT */}
                  <input type="hidden" value={edit.code} readOnly />

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
                  <span className={styles.detailLabel}>ID</span>
                  <span className={styles.detailValue}>{getIdActionPolicy(selected) ?? "—"}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Código</span>
                  <span className={styles.detailValue}>{getCode(selected) ?? "—"}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Descripción</span>
                  <span className={styles.detailValue}>{getDescription(selected) ?? "—"}</span>
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

                  <button
                    className={styles.btnDanger}
                    type="button"
                    onClick={() => void onChangeActive(false)}
                    disabled={saving || loading || !(getActive(selected) ?? false)}
                  >
                    Desactivar
                  </button>

                  {showInactive && (
                    <button
                      className={styles.btnSave}
                      type="button"
                      onClick={() => void onChangeActive(true)}
                      disabled={saving || loading || (getActive(selected) ?? false)}
                    >
                      Activar
                    </button>
                  )}
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
function getIdActionPolicy(r: ActionPolicyRow | null): number | null {
  if (!r) return null;
  const v = r.idActionPolicy ?? r.IdActionPolicy;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCode(r: ActionPolicyRow | null): number | null {
  if (!r) return null;
  const v = r.code ?? r.Code;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(r: ActionPolicyRow | null): string | null {
  if (!r) return null;
  const s = asTrim(r.description ?? r.Description ?? "");
  return s ? s : null;
}

function getActive(r: ActionPolicyRow | null): boolean | null {
  if (!r) return null;
  const v = r.active ?? r.Active;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = asTrim(v).toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return null;
}

function getStringProp(obj: UnknownObject, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
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

function isRecord(v: unknown): v is UnknownObject {
  return typeof v === "object" && v !== null;
}

function asObject(v: unknown): UnknownObject | null {
  return isRecord(v) ? (v as UnknownObject) : null;
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
