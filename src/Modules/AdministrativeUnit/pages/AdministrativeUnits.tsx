import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/administrativeUnits.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson } from "../../../services/api";

type AdministrativeUnit = {
  IdAdministrativeUnit?: number;
  Code?: number;
  Description?: string;
  Active?: boolean;

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

type UnknownRecord = Record<string, unknown>;

const API_BASE = "/api/AdministrativeUnit";

const initialForm: FormDto = {
  code: "",
  description: "",
  active: true,
};

export default function AdministrativeUnits() {
  const [rows, setRows] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<AdministrativeUnit | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

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

  const selectedId = useMemo(() => getId(selected), [selected]);
  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function smartCapitalize(value: string): string {
    if (!value) return "";

    const first = value.charAt(0);
    const rest = value.slice(1);

    if (first === first.toUpperCase()) return value;

    return first.toUpperCase() + rest;
  }

  function extractList(payload: unknown): AdministrativeUnit[] {
    if (Array.isArray(payload)) return payload as AdministrativeUnit[];
    if (isRecord(payload) && Array.isArray(payload.$values)) {
      return payload.$values as AdministrativeUnit[];
    }

    const obj = asObject(payload);
    if (!obj) return [];

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

    if (Array.isArray(possible)) return possible as AdministrativeUnit[];

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as AdministrativeUnit[];

    if (isRecord(payload)) return [payload as AdministrativeUnit];
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
      "value",
      "Value",
      "values",
      "Values",
    ];

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value;
      const nested = findArrayDeep(value, depth + 1);
      if (nested) return nested;
    }

    return null;
  }

  function codeExists(code: number): boolean {
    return rows.some((u) => getCode(u) === code);
  }

  function codeExistsExcept(code: number, excludeId: number | null): boolean {
    return rows.some((u) => {
      const currentCode = getCode(u);
      if (currentCode !== code) return false;

      const id = getId(u);
      if (excludeId == null || id == null) return true;
      return id !== excludeId;
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
          setFormEdit({
            code: String(getCode(found) ?? ""),
            description: capitalizeFirst(getDescription(found) ?? ""),
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

  function onRowClick(row: AdministrativeUnit) {
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
      description: capitalizeFirst(getDescription(selected) ?? ""),
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

  function validateForm(f: FormDto, isCreate: boolean): string {
    const codeNum = Number(f.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0) {
      return "La clave debe ser un número mayor a 0.";
    }

    if (isCreate) {
      if (codeExists(codeNum)) return "Ese código ya existe.";
    } else {
      if (codeExistsExcept(codeNum, selectedId)) return "Ese código ya existe.";
    }

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
      const payload = {
        Code: codeNum,
        Description: capitalizeFirst(formCreate.description),
        Active: Boolean(formCreate.active),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Unidad creada correctamente");
      setMode("view");
      setFormCreate(initialForm);
      await loadAll();
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    const id = selectedId;
    if (id == null || id <= 0) {
      return showToast("error", "No se pudo resolver el IdAdministrativeUnit.");
    }

    const msg = validateForm(formEdit, false);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        IdAdministrativeUnit: id,
        Code: Number(formEdit.code),
        Description: capitalizeFirst(formEdit.description),
        Active: Boolean(formEdit.active),
      };

      const result = await requestJson(`${API_BASE}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Unidad actualizada correctamente");
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
            <h1 className={styles.h1}>Unidades Administrativas</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                  ? "Viendo unidades inactivas."
                  : "Viendo unidades activas."}
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
              {mode === "create" ? "Creando..." : "+ Nueva"}
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
                  <th style={{ width: 140 }}>Clave</th>
                  <th>Descripción</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando unidades...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron unidades (activos o inactivos) con esos criterios."
                        : showInactive
                          ? "No hay unidades inactivas."
                          : "No hay unidades activas."}
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
                        <td className={styles.mono}>
                          {getCode(r) != null ? String(getCode(r)) : "—"}
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
                ? "Nueva unidad"
                : mode === "edit"
                  ? "Editar unidad"
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
                        onChange={(e) => {
                          const val = e.target.value;

                          setFormCreate((p) => ({
                            ...p,
                            description: smartCapitalize(val),
                          }));
                        }}
                        disabled={formDisabled}
                        placeholder="Descripción de la unidad"
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
                Selecciona una unidad de la tabla para ver detalles.
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
                        onChange={(e) => {
                          const val = e.target.value;

                          setFormEdit((p) => ({
                            ...p,
                            description: smartCapitalize(val),
                          }));
                        }}
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
                    <span className={styles.floatingLabel}>Clave</span>
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
  const s = asTrim(v ?? "");
  return s ? s : null;
}

function getActive(u: AdministrativeUnit | null): boolean | null {
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

function capitalizeFirst(value: unknown): string {
  const text = asTrim(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
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
