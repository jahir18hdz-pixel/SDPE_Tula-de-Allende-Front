import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../styles/FundingSource.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type FundingRow = {
  idFundingSource?: number;
  IdFundingSource?: number;

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
const API_BASE = `${BASE_API}/api/FundingSource`;

const initialForm: Form = {
  code: "",
  description: "",
  active: true,
};

export default function FundingSource() {
  const [rows, setRows] = useState<FundingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<FundingRow | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formCreate, setFormCreate] = useState<Form>(initialForm);
  const [formEdit, setFormEdit] = useState<Form>(initialForm);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const selectedId = useMemo(() => getIdFundingSource(selected), [selected]);
  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
    init?: RequestInit,
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

      if (selectedId != null) {
        const found =
          normalized.find((r) => getIdFundingSource(r) === selectedId) ?? null;
        setSelected(found);

        if (found && modeRef.current === "edit") {
          setFormEdit({
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

  function normalizeArray(payload: unknown): FundingRow[] {
    if (Array.isArray(payload)) return payload as FundingRow[];

    if (isRecord(payload) && Array.isArray(payload.$values)) {
      return payload.$values as FundingRow[];
    }

    const obj = asObject(payload);
    if (!obj) return [];

    const possible =
      obj.items ??
      obj.Items ??
      obj.data ??
      obj.Data ??
      obj.fundingSources ??
      obj.FundingSources ??
      obj.fondos ??
      obj.Fondos ??
      obj.values ??
      obj.Values ??
      obj.result ??
      obj.Result;

    if (Array.isArray(possible)) return possible as FundingRow[];

    const deep = findArrayDeep(payload, 0);
    if (deep) return deep as FundingRow[];

    if (isRecord(payload)) return [payload as FundingRow];
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
      "fundingSources",
      "FundingSources",
      "fondos",
      "Fondos",
    ];

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
      const nested = findArrayDeep(value, depth + 1);
      if (nested) return nested;
    }

    return null;
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

  const displayedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  function onRowClick(row: FundingRow) {
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
      description: getDescription(selected) ?? "",
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

  function normalizeCodeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const n = Number(digits);
    return Number.isFinite(n) ? String(n) : "";
  }

  function validateForm(f: Form, opts?: { excludeId?: number | null }): string {
    const codeNum = Number(f.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0) {
      return "El código debe ser un número mayor a 0.";
    }

    const excludeId = opts?.excludeId ?? null;
    const dup = rows.some((r) => {
      const id = getIdFundingSource(r);
      const code = getCode(r);
      if (code == null) return false;
      if (excludeId != null && id === excludeId) return false;
      return code === codeNum;
    });
    if (dup) return "Ese código ya existe. Ingresa uno diferente.";

    const desc = asTrim(f.description);
    if (!desc) return "La descripción es obligatoria.";
    if (desc.length < 3) return "La descripción es muy corta.";

    return "";
  }

  async function onCreate() {
    const msg = validateForm(formCreate);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        Code: Number(formCreate.code),
        Description: asTrim(formCreate.description),
        Active: Boolean(formCreate.active),
      };

      const result = await requestJson(`${API_BASE}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Fondo de financiamiento creado correctamente");
      setMode("view");
      setFormCreate(initialForm);
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
      return showToast("error", "No pude identificar el fondo seleccionado.");
    }

    const msg = validateForm(formEdit, { excludeId: id });
    if (msg) return showToast("error", msg);

    const codeNum = Number(formEdit.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0) {
      return showToast("error", "Código inválido.");
    }

    setSaving(true);
    try {
      const payload = {
        Code: codeNum,
        Description: asTrim(formEdit.description),
        Active: Boolean(formEdit.active),
      };

      const result = await requestJson(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Fondo de financiamiento actualizado correctamente");
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
            <h1 className={styles.h1}>Fondo de Financiamiento</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                  ? "Viendo fondos inactivos."
                  : "Viendo fondos activos."}
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
              placeholder="Buscar por código o descripción…"
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
              {mode === "create" ? "Creando..." : "+ Nuevo fondo"}
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
                  <th style={{ width: 140 }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando fondos...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron fondos (activos o inactivos) con esos criterios."
                        : showInactive
                          ? "No hay fondos inactivos."
                          : "No hay fondos activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => {
                    const id = getIdFundingSource(row);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected =
                      selectedId != null && id != null && id === selectedId;

                    const active = getActive(row) ?? false;
                    const fullDescription = getDescription(row);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(row)}
                      >
                        <td className={styles.mono}>{getCode(row) ?? "—"}</td>
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
                ? "Nuevo fondo"
                : mode === "edit"
                  ? "Editar fondo"
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
                      <span className={styles.floatingLabel}>Código</span>
                      <input
                        className={styles.floatingInput}
                        inputMode="numeric"
                        value={formCreate.code}
                        onChange={(e) =>
                          setFormCreate((p) => ({
                            ...p,
                            code: normalizeCodeInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Ej: 101"
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={formCreate.description}
                        onChange={(e) =>
                          setFormCreate((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Descripción del fondo"
                        rows={4}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={formCreate.active}
                        disabled={formDisabled}
                        label={formCreate.active ? "Activo" : "Inactivo"}
                        onChange={(next) =>
                          setFormCreate((p) => ({ ...p, active: next }))
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
                Selecciona un fondo de la tabla para ver detalles.
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
                      <span className={styles.floatingLabel}>Código</span>
                      <input
                        className={styles.floatingInput}
                        inputMode="numeric"
                        value={formEdit.code}
                        onChange={(e) =>
                          setFormEdit((p) => ({
                            ...p,
                            code: normalizeCodeInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        placeholder="Ej: 101"
                      />
                    </div>

                    <div className={styles.floatingFieldArea}>
                      <span className={styles.floatingLabel}>Descripción</span>
                      <textarea
                        className={styles.floatingTextareaArea}
                        value={formEdit.description}
                        onChange={(e) =>
                          setFormEdit((p) => ({
                            ...p,
                            description: e.target.value,
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
                        checked={formEdit.active}
                        disabled={formDisabled}
                        label={formEdit.active ? "Activo" : "Inactivo"}
                        onChange={(next) =>
                          setFormEdit((p) => ({ ...p, active: next }))
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
                    <span className={styles.floatingLabel}>Código</span>
                    <div className={styles.floatingValue}>
                      {getCode(selected) ?? "—"}
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
function getIdFundingSource(r: FundingRow | null): number | null {
  if (!r) return null;
  const v = r.idFundingSource ?? r.IdFundingSource;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCode(r: FundingRow | null): number | null {
  if (!r) return null;
  const v = r.code ?? r.Code;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(r: FundingRow | null): string | null {
  if (!r) return null;
  const s = asTrim(r.description ?? r.Description ?? "");
  return s ? s : null;
}

function getActive(r: FundingRow | null): boolean | null {
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