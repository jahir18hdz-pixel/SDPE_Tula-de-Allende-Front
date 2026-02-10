import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/administrativeUnits.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ConfirmDialog from "../../../Components/layout/ConfirmDialog";

type AdministrativeUnit = {
  // DTO real
  IdAdministrativeUnit?: number;
  Code?: number;
  Description?: string;
  Active?: boolean;

  // variantes por si llega camelCase
  idAdministrativeUnit?: number;
  code?: number;
  description?: string;
  active?: boolean;

  isActive?: boolean;
  IsActive?: boolean;

  id?: number;
  Id?: number;

  descripcion?: string;
  Descripcion?: string;

  [key: string]: unknown;
};

type FormDto = {
  code: string;
  description: string;
  active: boolean;
};

type AuthStored = {
  token?: string;
  Token?: string;
};

type UnknownRecord = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const API_BASE = `${BASE_API}/api/AdministrativeUnit`;

export default function AdministrativeUnits() {
  const [rows, setRows] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<AdministrativeUnit | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [form, setForm] = useState<FormDto>({
    code: "",
    description: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // buscador
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // paginación
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

  const selectedCode = useMemo(() => getCode(selected), [selected]);
  const selectedId = useMemo(() => getId(selected), [selected]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || isSearching) return rows;

    const maybeNum = Number(q);
    const isNum = Number.isFinite(maybeNum) && q !== "";

    if (isNum) return rows.filter((u) => String(getCode(u) ?? "").includes(q));

    return rows.filter((u) => (getDescription(u) ?? "").toLowerCase().includes(q));
  }, [rows, search, isSearching]);

  const totalCount = useMemo(() => filteredRows.length, [filteredRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);

  const displayedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

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
    const res = await fetch(url, { ...init, credentials: "omit" });

    if (res.status === 204) return { ok: true, data: [], status: 204 };

    const text = await safeText(res);
    const parsed = tryParseJson(text);

    if (!res.ok) {
      const apiMsg = isRecord(parsed) && typeof parsed.message === "string" ? parsed.message : "";
      const msg = apiMsg || (typeof parsed === "string" ? parsed : "") || text || `HTTP ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: parsed, status: res.status };
  }

  function extractList(payload: unknown): AdministrativeUnit[] {
    if (Array.isArray(payload)) return payload as AdministrativeUnit[];
    if (isRecord(payload) && Array.isArray(payload.$values)) return payload.$values as AdministrativeUnit[];
    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as AdministrativeUnit[];
    if (isRecord(payload)) return [payload as AdministrativeUnit];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const values = payload["$values"];
    if (Array.isArray(values)) return values;

    const keys = ["data", "result", "items", "value", "values", "Items", "Data", "Result"];
    for (const k of keys) {
      const v = payload[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function codeExists(code: number): boolean {
    return rows.some((u) => getCode(u) === code);
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

      const result = await requestJson(API_BASE, { method: "GET", headers: authHeaders() });

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const list = extractList(result.data);
      setRows(list);
      setPage(1);

      if (keepSelected != null) {
        const found = list.find((r) => getCode(r) === keepSelected) ?? null;
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

  async function searchByCode(code: number) {
    setIsSearching(true);
    setLoading(true);
    try {
      const result = await requestJson(`${API_BASE}/${code}`, { method: "GET", headers: authHeaders() });

      if (!result.ok) {
        if (result.status === 404) {
          showToast("error", `No se encontró la unidad con clave ${code}.`);
          setRows([]);
          setSelected(null);
          setMode("view");
          return;
        }
        showToast("error", result.error);
        return;
      }

      const unit = extractList(result.data);
      setRows(unit);
      setPage(1);

      const found = unit[0] ?? null;
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
    if (!q) return loadAll();

    const num = Number(q);
    const isNum = Number.isFinite(num) && q !== "";

    if (isNum) return searchByCode(num);

    setIsSearching(true);
    await loadAll();
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
    setForm({ code: "", description: "", active: true });
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setForm({ code: "", description: "", active: true });
  }

  function startEdit(row: AdministrativeUnit) {
    setMode("edit");
    setSelected(row);
    setForm({
      code: String(getCode(row) ?? ""),
      description: String(getDescription(row) ?? ""),
      active: getActive(row) ?? true,
    });
  }

  function onRowClick(row: AdministrativeUnit) {
    setSelected(row);
    setMode("view");
  }

  function validateForm(): string {
    const codeNum = Number(form.code);

    if (!Number.isFinite(codeNum) || codeNum <= 0) return "La clave debe ser un número mayor a 0.";
    if (mode === "create" && codeExists(codeNum)) return "No se pueden repetir las claves.";
    if (!form.description.trim()) return "La descripción es obligatoria.";
    if (form.description.trim().length < 3) return "La descripción es muy corta.";
    return "";
  }

  async function onCreate() {
    const msg = validateForm();
    if (msg) return showToast("error", msg);

    const codeNum = Number(form.code);
    if (codeExists(codeNum)) return showToast("error", "Clave duplicada. No se pueden repetir las claves.");

    setSaving(true);
    try {
      const payload = {
        Code: codeNum,
        Description: form.description.trim(),
        Active: form.active,
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Unidad creada correctamente");
      setMode("view");
      await loadAll(codeNum);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected) return showToast("error", "Selecciona una unidad para editar.");

    const msg = validateForm();
    if (msg) return showToast("error", msg);

    // ✅ TU BACK: PUT /{id:int}
    if (selectedId == null) return showToast("error", "No se pudo resolver el IdAdministrativeUnit.");

    setSaving(true);
    try {
      const payload = {
        IdAdministrativeUnit: selectedId,
        Code: Number(form.code),
        Description: form.description.trim(),
        Active: form.active,
      };

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Unidad actualizada correctamente");
      setMode("view");

      if (selectedCode != null) await loadAll(selectedCode);
      else await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /**
   * ✅ FIX: algunos backends con [FromBody] bool no toman bien false/true
   * dependiendo de configuración, así que hacemos:
   *  1) PATCH con body: true/false (raw JSON)
   *  2) si falla (400/415), reintenta con { active: true/false }
   */
  async function patchActive(code: number, next: boolean) {
    // intento 1: bool directo
    const r1 = await requestJson(`${API_BASE}/${code}/active`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(next),
    });

    if (r1.ok) return;

    // intento 2: objeto { active: next }
    // (por si el backend realmente espera un DTO)
    const r2 = await requestJson(`${API_BASE}/${code}/active`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ active: next }),
    });

    if (!r2.ok) throw new Error(r2.error);
  }

  // activar directo; desactivar con confirm
  async function onToggleActive(next: boolean) {
    if (!selected || selectedCode == null) return showToast("error", "Selecciona una unidad.");

    if (next === false) {
      setConfirmOpen(true);
      return;
    }

    setSaving(true);
    try {
      await patchActive(selectedCode, true);
      showToast("success", "Unidad activada correctamente");
      await loadAll(selectedCode);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDeactivate() {
    if (!selected || selectedCode == null) {
      setConfirmOpen(false);
      return showToast("error", "Selecciona una unidad.");
    }

    setSaving(true);
    try {
      await patchActive(selectedCode, false);
      showToast("success", "Unidad desactivada correctamente");
      await loadAll(selectedCode);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      // muy importante: si falló, recarga para que el switch refleje el back real
      await loadAll(selectedCode);
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
        title="Desactivar unidad"
        message={`¿Estás seguro de desactivar la unidad "${getDescription(selected) ?? "—"}" (clave ${
          selectedCode ?? "—"
        })? Esta acción no se puede deshacer.`}
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onConfirmDeactivate}
      />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Unidades Administrativas</h1>
            <p className={styles.sub}>Consulta, crea, edita o activa/desactiva unidades administrativas.</p>
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
              placeholder="Buscar por clave o descripción…"
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
                  <th style={{ width: 120 }}>Clave</th>
                  <th>Descripción</th>
                  <th style={{ width: 140 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando unidades...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {search.trim() ? "No se encontraron unidades con esos criterios." : "No hay unidades registradas."}
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      No hay registros en esta página.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const code = getCode(r);
                    const desc = getDescription(r) ?? "—";
                    const active = getActive(r) ?? false;

                    const key = code != null ? String(code) : `row-${idx}`;
                    const isSelected = selectedCode != null && code != null && code === selectedCode;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>{code != null ? String(code) : "—"}</td>
                        <td>{desc}</td>
                        <td>
                          <Switch checked={active} disabled />
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
              {mode === "create" ? "Nueva unidad" : mode === "edit" ? "Editar unidad" : "Detalle"}
            </p>
          </div>

          <div className={styles.panelBody}>
            {mode === "view" ? (
              !selected ? (
                <div className={styles.helper}>Selecciona una unidad de la tabla para ver detalles o editar.</div>
              ) : (
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Clave</span>
                    <span className={styles.mono}>{String(selectedCode ?? "—")}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Id</span>
                    <span className={styles.mono}>{String(selectedId ?? "—")}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Descripción</span>
                    <span className={styles.detailValue}>{String(getDescription(selected) ?? "—")}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Activo</span>
                    <Switch
                      checked={getActive(selected) ?? false}
                      disabled={saving}
                      onChange={(next) => void onToggleActive(next)}
                    />
                  </div>

                  <div className={styles.actions}>
                    <button className={styles.btnGhost} type="button" onClick={clearSelection} disabled={saving}>
                      Cancelar
                    </button>

                    <button className={styles.btnEdit} type="button" onClick={() => startEdit(selected)} disabled={saving}>
                      Editar
                    </button>

                    <button
                      className={styles.btnDanger}
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={saving || (getActive(selected) ?? false) === false}
                    >
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
                  <Field label="Clave" required>
                    <input
                      className={styles.input}
                      value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                      disabled={saving || mode === "edit"}
                      inputMode="numeric"
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
                    {saving ? "Guardando..." : mode === "create" ? "Crear unidad" : "Guardar cambios"}
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
function getId(u: AdministrativeUnit | null): number | null {
  if (!u) return null;
  const v = u.IdAdministrativeUnit ?? u.idAdministrativeUnit ?? u.id ?? u.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCode(u: AdministrativeUnit | null): number | null {
  if (!u) return null;
  const v = u.Code ?? u.code;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(u: AdministrativeUnit | null): string | null {
  if (!u) return null;
  const v = u.Description ?? u.description ?? u.descripcion ?? u.Descripcion;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getActive(u: AdministrativeUnit | null): boolean | null {
  if (!u) return null;

  const v: unknown = u.Active ?? u.active ?? u.isActive ?? u.IsActive;

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
