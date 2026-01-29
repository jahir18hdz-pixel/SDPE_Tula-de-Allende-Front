// src/Modules/AdministrativeUnit/pages/AdministrativeUnits.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "../styles/administrativeUnits.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ConfirmDialog from "../../../Components/layout/ConfirmDialog";

type AdministrativeUnit = {
  code?: number;
  id?: number;
  description?: string;

  Code?: number;
  Id?: number;
  Description?: string;

  administrativeUnitCode?: number;
  administrativeUnitId?: number;
  AdministrativeUnitCode?: number;
  AdministrativeUnitId?: number;

  descripcion?: string;
  Descripcion?: string;

  [key: string]: unknown;
};

type FormDto = {
  code: string;
  description: string;
};

const API_BASE = "/api/AdministrativeUnit";

export default function AdministrativeUnits() {
  const [rows, setRows] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<AdministrativeUnit | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [form, setForm] = useState<FormDto>({ code: "", description: "" });

  const [saving, setSaving] = useState(false);

  // ✅ Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ Toast como Login
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const selectedCode = useMemo(() => getCode(selected), [selected]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function authHeaders(): HeadersInit {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function requestJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
    const res = await fetch(input, { credentials: "include", ...init });

    const json = await safeJson<unknown>(res);

    if (!res.ok) {
      const apiMsg =
        isRecord(json) && typeof json.message === "string" ? json.message : "";
      const txt = await safeText(res);
      const msg =
        apiMsg ||
        txt ||
        `Error HTTP ${res.status} (${res.statusText || "Solicitud fallida"})`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: json as T };
  }

  async function loadAll(keepSelected?: number | null) {
    setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const result = await requestJson<AdministrativeUnit[]>(API_BASE, {
        method: "GET",
        headers: authHeaders(),
        signal: ac.signal,
      });

      if (!mountedRef.current) return;

      if (!result.ok) {
        const msg =
          result.status === 401
            ? "No autorizado (401). Inicia sesión para cargar unidades."
            : result.error;
        showToast("error", msg);
        return;
      }

      const list = Array.isArray(result.data) ? result.data : [];
      setRows(list);

      if (keepSelected != null) {
        const found = list.find((u) => getCode(u) === keepSelected) ?? null;
        setSelected(found);
        setMode("view");
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      showToast("error", toErrorMessage(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
    setForm({ code: "", description: "" });
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setForm({ code: "", description: "" });
  }

  function startEdit(row: AdministrativeUnit) {
    setMode("edit");
    setSelected(row);
    setForm({
      code: String(getCode(row) ?? ""),
      description: String(getDescription(row) ?? ""),
    });
  }

  function onRowClick(row: AdministrativeUnit) {
    setSelected(row);
    setMode("view");
  }

  function validateForm(): string {
    const codeNum = Number(form.code);
    if (!Number.isFinite(codeNum) || codeNum <= 0)
      return "La clave debe ser un número mayor a 0.";
    if (!form.description.trim()) return "La descripción es obligatoria.";
    if (form.description.trim().length < 3) return "La descripción es muy corta.";
    return "";
  }

  async function onCreate() {
    const msg = validateForm();
    if (msg) {
      showToast("error", msg);
      return;
    }

    setSaving(true);

    const payload = {
      code: Number(form.code),
      description: form.description.trim(),
      Code: Number(form.code),
      Description: form.description.trim(),
      descripcion: form.description.trim(),
      Descripcion: form.description.trim(),
    };

    try {
      const result = await requestJson<unknown>(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        const errMsg =
          result.status === 401
            ? "No autorizado (401). Inicia sesión para crear unidades."
            : result.error;
        showToast("error", errMsg);
        return;
      }

      showToast("success", "Unidad creada correctamente");
      setMode("view");
      await loadAll(Number(form.code));
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected || selectedCode == null) {
      showToast("error", "Selecciona una unidad para editar.");
      return;
    }

    if (!form.description.trim()) {
      showToast("error", "La descripción es obligatoria.");
      return;
    }

    setSaving(true);

    const payload = {
      description: form.description.trim(),
      Description: form.description.trim(),
      descripcion: form.description.trim(),
      Descripcion: form.description.trim(),
    };

    try {
      const result = await requestJson<unknown>(`${API_BASE}/${selectedCode}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        const errMsg =
          result.status === 401
            ? "No autorizado (401). Inicia sesión para actualizar unidades."
            : result.error;
        showToast("error", errMsg);
        return;
      }

      showToast("success", "Unidad actualizada correctamente");
      setMode("view");
      await loadAll(selectedCode);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirmed() {
    if (!selected || selectedCode == null) {
      setConfirmOpen(false);
      showToast("error", "Selecciona una unidad para eliminar.");
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<unknown>(`${API_BASE}/${selectedCode}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!result.ok) {
        const errMsg =
          result.status === 401
            ? "No autorizado (401). Inicia sesión para eliminar unidades."
            : result.error;
        showToast("error", errMsg);
        return;
      }

      showToast("success", "Unidad eliminada correctamente");
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
        title="Eliminar unidad administrativa"
        message={`¿Estás seguro de eliminar la unidad "${
          getDescription(selected) ?? "—"
        }" (clave ${selectedCode ?? "—"})? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onDeleteConfirmed}
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.h1}>Unidades administrativas</h1>
          <p className={styles.sub}>
            Consulta, crea, edita o elimina unidades administrativas.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.btnPrimary}
            onClick={startCreate}
            disabled={saving || mode === "create"}
            type="button"
          >
            {mode === "create" ? "Creando..." : "+ Nueva unidad"}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* TABLA */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Listado</p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Clave</th>
                  <th>Descripción</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2} className={styles.empty}>
                      Cargando unidades...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.empty}>
                      No hay unidades registradas.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const code = getCode(r);
                    const desc = getDescription(r) ?? "—";
                    const key = code != null ? String(code) : `row-${idx}`;
                    const isSelected =
                      selectedCode != null && code != null && code === selectedCode;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>
                          {code != null ? String(code) : "—"}
                        </td>
                        <td>{desc}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PANEL DERECHO */}
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
            {mode === "view" ? (
              !selected ? (
                <div className={styles.helper}>
                  Selecciona una unidad de la tabla para ver detalles o editar.
                </div>
              ) : (
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Clave</span>
                    <span className={styles.mono}>
                      {String(selectedCode ?? "—")}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Descripción</span>
                    <span className={styles.detailValue}>
                      {String(getDescription(selected) ?? "—")}
                    </span>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      onClick={clearSelection}
                      disabled={saving}
                    >
                      Cancelar
                    </button>

                    <button
                      className={styles.btnEdit}
                      type="button"
                      onClick={() => startEdit(selected)}
                      disabled={saving}
                    >
                      Editar
                    </button>

                    <button
                      className={styles.btnDanger}
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={saving}
                    >
                      Eliminar
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
                      onChange={(e) =>
                        setForm((p) => ({ ...p, code: e.target.value }))
                      }
                      disabled={saving || mode === "edit"}
                      inputMode="numeric"
                    />
                  </Field>

                  <Field label="Descripción" required>
                    <input
                      className={styles.input}
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={clearSelection}
                    disabled={saving}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={saving}
                  >
                    {saving
                      ? "Guardando..."
                      : mode === "create"
                      ? "Crear unidad"
                      : "Guardar cambios"}
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

/** Helpers */
function getCode(u: AdministrativeUnit | null): number | null {
  if (!u) return null;

  const v =
    u.code ??
    u.id ??
    u.Code ??
    u.Id ??
    u.administrativeUnitCode ??
    u.administrativeUnitId ??
    u.AdministrativeUnitCode ??
    u.AdministrativeUnitId;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDescription(u: AdministrativeUnit | null): string | null {
  if (!u) return null;
  const v = u.description ?? u.Description ?? u.descripcion ?? u.Descripcion;
  const s = String(v ?? "").trim();
  return s ? s : null;
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

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
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
