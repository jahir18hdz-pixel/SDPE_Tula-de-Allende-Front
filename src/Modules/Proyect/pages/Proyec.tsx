import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../styles/Proyect.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type ProyectRow = {
  idProyect?: number;
  IdProyect?: number;

  code?: number;
  Code?: number;

  description?: string;
  Description?: string;

  active?: boolean | number | string;
  Active?: boolean | number | string;

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
const API_BASE = `${BASE_API}/api/Proyect`;

const initialForm: Form = {
  code: "",
  description: "",
  active: true,
};

export default function Proyect() {
  const [rows, setRows] = useState<ProyectRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<ProyectRow | null>(null);
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

  const selectedCode = useMemo(() => getCode(selected), [selected]);
  const selectedId = useMemo(() => getIdProyect(selected), [selected]);

  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void loadAll(null);
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
      const apiMsg =
        isRecord(parsed) && typeof parsed.message === "string"
          ? parsed.message
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

  function normalizeArray(payload: unknown): ProyectRow[] {
    if (Array.isArray(payload)) return payload as ProyectRow[];

    if (isRecord(payload) && Array.isArray(payload.$values)) {
      return payload.$values as ProyectRow[];
    }

    const obj = asObject(payload);
    if (!obj) return [];

    const possible =
      obj.items ??
      obj.Items ??
      obj.data ??
      obj.Data ??
      obj.proyects ??
      obj.Proyects ??
      obj.projects ??
      obj.Projects ??
      obj.proyectos ??
      obj.Proyectos ??
      obj.values ??
      obj.Values ??
      obj.result ??
      obj.Result;

    if (Array.isArray(possible)) return possible as ProyectRow[];

    const deep = findArrayDeep(payload, 0);
    if (deep) return deep as ProyectRow[];

    if (isRecord(payload)) return [payload as ProyectRow];
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
      "projects",
      "Projects",
      "proyects",
      "Proyects",
      "proyectos",
      "Proyectos",
    ];

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
      const nested = findArrayDeep(value, depth + 1);
      if (nested) return nested;
    }

    return null;
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

      const normalized = normalizeArray(result.data);
      setRows(normalized);

      if (keepSelectedCode != null) {
        const found =
          normalized.find((r) => getCode(r) === keepSelectedCode) ?? null;
        setSelected(found);

        if (found && modeRef.current === "edit") {
          setFormEdit({
            code: String(getCode(found) ?? ""),
            description: String(getDescription(found) ?? ""),
            active: getActive(found) ?? true,
          });
        }
      } else if (selectedCode != null) {
        const found =
          normalized.find((r) => getCode(r) === selectedCode) ?? null;
        setSelected(found);

        if (found && modeRef.current === "edit") {
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

  function normalizeCodeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const n = Number(digits);
    return Number.isFinite(n) ? String(n) : "";
  }

  function codeExists(code: number): boolean {
    return rows.some((r) => getCode(r) === code);
  }

  function codeExistsExcept(code: number, exceptId: number | null): boolean {
    return rows.some((r) => {
      const rowCode = getCode(r);
      const rowId = getIdProyect(r);
      if (rowCode !== code) return false;
      if (exceptId == null) return true;
      return rowId !== exceptId;
    });
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
      const desc = String(getDescription(r) ?? "").toLowerCase();
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

  function onRowClick(row: ProyectRow) {
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
    setSearch("");
  }

  function validateForm(f: Form, isCreate: boolean): string {
    const codeNum = Number(f.code);

    if (!Number.isFinite(codeNum) || codeNum <= 0) {
      return "La clave debe ser un número mayor a 0.";
    }

    if (isCreate) {
      if (codeExists(codeNum)) return "No se pueden repetir las claves.";
    } else {
      const sid = getIdProyect(selected);
      if (codeExistsExcept(codeNum, sid)) {
        return "No se pueden repetir las claves.";
      }
    }

    const desc = asTrim(f.description);
    if (!desc) return "La descripción es obligatoria.";
    if (desc.length < 3) return "La descripción es muy corta.";

    return "";
  }

  async function onCreate() {
    const msg = validateForm(formCreate, true);
    if (msg) {
      showToast("error", msg);
      return;
    }

    const codeNum = Number(formCreate.code);

    setSaving(true);
    try {
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

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      showToast("success", "Proyecto creado correctamente");
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
    if (!selected) {
      showToast("error", "Selecciona un proyecto para editar.");
      return;
    }

    const msg = validateForm(formEdit, false);
    if (msg) {
      showToast("error", msg);
      return;
    }

    if (selectedId == null) {
      showToast("error", "No se pudo resolver el idProyect.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        idProyect: selectedId,
        Code: Number(formEdit.code),
        Description: asTrim(formEdit.description),
        Active: Boolean(formEdit.active),
      };

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      const newCode = Number(formEdit.code);

      showToast("success", "Proyecto actualizado correctamente");
      setMode("view");
      setSelected(null);
      await loadAll(Number.isFinite(newCode) ? newCode : null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive() {
    if (!selected) {
      showToast("error", "Selecciona un proyecto.");
      return;
    }

    const code = getCode(selected);
    if (code == null) {
      showToast("error", "No se pudo resolver el Code.");
      return;
    }

    const next = !(getActive(selected) ?? false);

    setSaving(true);
    try {
      const result = await requestJson(`${API_BASE}/${code}/active`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(next),
      });

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      showToast(
        "success",
        `Estatus actualizado: ${next ? "Activo" : "Inactivo"}`,
      );
      await loadAll(code);
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
            <h1 className={styles.h1}>Proyectos</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                  ? "Viendo proyectos inactivos."
                  : "Viendo proyectos activos."}
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
              placeholder="Buscar por clave o descripción…"
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
              {mode === "create" ? "Creando..." : "+ Nuevo proyecto"}
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
                  <th style={{ width: 120 }}>Clave</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando proyectos...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron proyectos (activos o inactivos) con esos criterios."
                        : showInactive
                          ? "No hay proyectos inactivos."
                          : "No hay proyectos activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const code = getCode(r);
                    const key = code != null ? String(code) : `row-${idx}`;
                    const isSelected =
                      selectedCode != null &&
                      code != null &&
                      code === selectedCode;
                    const active = getActive(r) ?? false;
                    const fullDescription = getDescription(r);

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>
                          {code != null ? String(code) : "—"}
                        </td>
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
                ? "Nuevo proyecto"
                : mode === "edit"
                  ? "Editar proyecto"
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
                      <span className={styles.floatingLabel}>Clave</span>
                      <input
                        className={styles.floatingInput}
                        value={formCreate.code}
                        onChange={(e) =>
                          setFormCreate((p) => ({
                            ...p,
                            code: normalizeCodeInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        inputMode="numeric"
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
                        onBlur={(e) =>
                          setFormCreate((p) => ({
                            ...p,
                            description: breakTextEvery12Words(e.target.value),
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
                Selecciona un proyecto de la tabla para ver detalles.
              </div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onUpdate();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailCard}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Clave</span>
                      <input
                        className={styles.floatingInput}
                        value={formEdit.code}
                        onChange={(e) =>
                          setFormEdit((p) => ({
                            ...p,
                            code: normalizeCodeInput(e.target.value),
                          }))
                        }
                        disabled={formDisabled}
                        inputMode="numeric"
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
                        onBlur={(e) =>
                          setFormEdit((p) => ({
                            ...p,
                            description: breakTextEvery12Words(e.target.value),
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
                    <span className={styles.floatingLabel}>Clave</span>
                    <div className={styles.floatingValue}>
                      {String(selectedCode ?? "—")}
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
                      disabled={formDisabled}
                      label={
                        (getActive(selected) ?? false) ? "Activo" : "Inactivo"
                      }
                      onChange={() => void onToggleActive()}
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

function getIdProyect(r: ProyectRow | null): number | null {
  if (!r) return null;
  const v = r.idProyect ?? r.IdProyect;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCode(r: ProyectRow | null): number | null {
  if (!r) return null;
  const v = r.code ?? r.Code;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(r: ProyectRow | null): string | null {
  if (!r) return null;
  const s = asTrim(r.description ?? r.Description ?? "");
  return s ? s : null;
}

function getActive(r: ProyectRow | null): boolean | null {
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
