import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/acquisitionClassifications.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type AcquisitionClassification = {
  // DTO real (según tu código)
  idAcquisitionClassification?: number;
  Code?: number;
  Description?: string;
  Active?: boolean;

  // variantes por si llega camelCase u otras
  IdAcquisitionClassification?: number;
  code?: number;
  description?: string;
  active?: boolean;

  isActive?: boolean;
  IsActive?: boolean;

  id?: number;
  Id?: number;

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
const API_BASE = `${BASE_API}/api/AcquisitionClassification`;

const initialForm: FormDto = {
  code: "",
  description: "",
  active: true,
};

export default function AcquisitionClassifications() {
  const [rows, setRows] = useState<AcquisitionClassification[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<AcquisitionClassification | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  // paginación FRONT
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formCreate, setFormCreate] = useState<FormDto>(initialForm);
  const [formEdit, setFormEdit] = useState<FormDto>(initialForm);

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
    void loadAll(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function extractList(payload: unknown): AcquisitionClassification[] {
    if (Array.isArray(payload)) return payload as AcquisitionClassification[];
    if (isRecord(payload) && Array.isArray((payload as UnknownRecord).$values)) {
      return (payload as UnknownRecord).$values as AcquisitionClassification[];
    }

    const obj = isRecord(payload) ? (payload as UnknownRecord) : null;
    if (obj) {
      const possible =
        obj.items ??
        obj.Items ??
        obj.data ??
        obj.Data ??
        obj.result ??
        obj.Result ??
        obj.value ??
        obj.Value ??
        obj.values ??
        obj.Values;

      if (Array.isArray(possible)) return possible as AcquisitionClassification[];
    }

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as AcquisitionClassification[];

    if (isRecord(payload)) return [payload as AcquisitionClassification];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const obj = payload as UnknownRecord;

    const values = obj["$values"];
    if (Array.isArray(values)) return values;

    const keys = ["data", "result", "items", "value", "values", "Items", "Data", "Result"];
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function codeExists(code: number): boolean {
    return rows.some((u) => getCode(u) === code);
  }

  async function loadAll(keepSelectedCode?: number | null) {
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

      if (keepSelectedCode != null) {
        const found = list.find((r) => getCode(r) === keepSelectedCode) ?? null;
        setSelected(found);
        setMode("view");

        if (found && mode === "edit") {
          setFormEdit({
            code: String(getCode(found) ?? ""),
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
   * ✅ FILTRO (igual tu vista)
   * - Sin búsqueda: respeta showInactive (activos/inactivos)
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

    return base.filter((u) => {
      const code = String(getCode(u) ?? "").toLowerCase();
      const desc = String(getDescription(u) ?? "").toLowerCase();
      return code.includes(q) || desc.includes(q);
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

  function onRowClick(row: AcquisitionClassification) {
    setSelected(row);
    setMode("view");
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setFormCreate(initialForm);
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
  }

  function startEdit() {
    if (!selected) return;
    setFormEdit({
      code: String(getCode(selected) ?? ""),
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
    const codeNum = Number(f.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0) return "La clave debe ser un número mayor a 0.";
    if (isCreate && codeExists(codeNum)) return "No se pueden repetir las claves.";

    const desc = asTrim(f.description);
    if (!desc) return "La descripción es obligatoria.";
    if (desc.length < 3) return "La descripción es muy corta.";
    return "";
  }

  async function onCreate() {
    const msg = validateForm(formCreate, true);
    if (msg) return showToast("error", msg);

    const codeNum = Number(formCreate.code);

    setSaving(true);
    try {
      // AddAcquisitionClassificationCmd (Code, Description, Active)
      const payload = {
        Code: codeNum,
        Description: asTrim(formCreate.description),
        Active: Boolean(formCreate.active),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Clasificación creada correctamente");
      setMode("view");
      setFormCreate(initialForm);
      await loadAll(codeNum);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected) return showToast("error", "Selecciona un registro para editar.");

    const msg = validateForm(formEdit, false);
    if (msg) return showToast("error", msg);

    if (selectedId == null) return showToast("error", "No se pudo resolver el idAcquisitionClassification.");

    setSaving(true);
    try {
      // UpdateAcqClassificationCmd: el controller fuerza el id desde la URL
      const payload = {
        // si tu record usa otro nombre, no pasa nada si el back ignora; el id lo toma de la URL
        idUpdateAcquisitionClassification: selectedId,
        Code: Number(formEdit.code),
        Description: asTrim(formEdit.description),
        Active: Boolean(formEdit.active),
      };

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Clasificación actualizada correctamente");
      setMode("view");
      setSelected(null);
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive() {
    if (!selected) return showToast("error", "Selecciona un registro.");
    const code = selectedCode;
    if (code == null) return showToast("error", "No se pudo resolver el Code.");

    const current = getActive(selected) ?? false;
    const next = !current;

    setSaving(true);
    try {
      // PATCH /{code}/active  body: bool
      const result = await requestJson(`${API_BASE}/${code}/active`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(next),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", next ? "Se activó correctamente" : "Se desactivó correctamente");
      setSelected(null);
      setMode("view");
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
            <h1 className={styles.h1}>Clasificación de Adquisiciones</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                ? "Viendo registros inactivos."
                : "Viendo registros activos."}
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
              placeholder="Buscar por clave o descripción…"
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
              {showInactive ? "Ver activos" : "Ver inactivos"}
            </button>

            <button className={styles.btnPrimary} onClick={startCreate} disabled={saving || mode === "create"} type="button">
              {mode === "create" ? "Creando..." : "+ Nueva"}
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
                  <th style={{ width: 120 }}>Clave</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando clasificaciones...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron registros (activos o inactivos) con esos criterios."
                        : showInactive
                        ? "No hay registros inactivos."
                        : "No hay registros activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const code = getCode(r);
                    const key = code != null ? String(code) : `row-${idx}`;
                    const isSelected = selectedCode != null && code != null && code === selectedCode;
                    const active = getActive(r) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>{code != null ? String(code) : "—"}</td>
                        <td>{getDescription(r) ?? "—"}</td>
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
              {mode === "create" ? "Nueva clasificación" : mode === "edit" ? "Editar clasificación" : "Detalle"}
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
                  <Field label="Clave" required>
                    <input
                      className={styles.input}
                      value={formCreate.code}
                      onChange={(e) => setFormCreate((p) => ({ ...p, code: e.target.value }))}
                      disabled={createDisabled}
                      inputMode="numeric"
                      placeholder="Ej: 10"
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={formCreate.description}
                      onChange={(e) => setFormCreate((p) => ({ ...p, description: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Descripción"
                    />
                  </Field>

                  <Field label="Activo">
                    <Switch
                      checked={formCreate.active}
                      disabled={createDisabled}
                      label={formCreate.active ? "Activo" : "Inactivo"}
                      onChange={(next) => setFormCreate((p) => ({ ...p, active: next }))}
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
              <div className={styles.helper}>Selecciona un registro de la tabla para ver detalles.</div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onUpdate();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Id</span>
                    <span className={styles.mono}>{String(selectedId ?? "—")}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Clave</span>
                    <span className={styles.mono}>{String(selectedCode ?? "—")}</span>
                  </div>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={formEdit.description}
                      onChange={(e) => setFormEdit((p) => ({ ...p, description: e.target.value }))}
                      disabled={saving || loading}
                      placeholder="Descripción"
                    />
                  </Field>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Activo</span>
                    <Switch
                      checked={formEdit.active}
                      disabled={saving || loading}
                      label={formEdit.active ? "Activo" : "Inactivo"}
                      onChange={(next) => setFormEdit((p) => ({ ...p, active: next }))}
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
                  <Switch checked={getActive(selected) ?? false} disabled label={(getActive(selected) ?? false) ? "Activo" : "Inactivo"} />
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
                    onClick={() => void onToggleActive()}
                    disabled={saving || loading}
                    title="Activa/Desactiva por Code (PATCH)"
                  >
                    {(getActive(selected) ?? false) ? "Desactivar" : "Activar"}
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
        aria-label={label ?? "Cambiar estado"}
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
function getId(u: AcquisitionClassification | null): number | null {
  if (!u) return null;
  const v =
    u.idAcquisitionClassification ??
    u.IdAcquisitionClassification ??
    u.id ??
    u.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCode(u: AcquisitionClassification | null): number | null {
  if (!u) return null;
  const v = u.Code ?? u.code;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(u: AcquisitionClassification | null): string | null {
  if (!u) return null;
  const v = u.Description ?? u.description;
  const s = asTrim(v ?? "");
  return s ? s : null;
}

function getActive(u: AcquisitionClassification | null): boolean | null {
  if (!u) return null;

  const v: unknown = u.Active ?? u.active ?? u.isActive ?? u.IsActive;

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
