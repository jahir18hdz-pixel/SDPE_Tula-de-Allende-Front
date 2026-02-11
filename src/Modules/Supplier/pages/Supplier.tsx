import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Suplier.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type Supplier = {
  // DTO (PascalCase)
  IdSupplier?: number;
  Rfc?: string;
  BusinessName?: string;

  Street?: string;
  ExternalNumber?: string | null;
  InternalNumber?: string | null;
  Neighborhood?: string | null;
  PostalCode?: number;

  City?: string | null;
  Municipality?: string;
  State?: string;
  Country?: string;

  Phone?: string | null;
  ContactName?: string | null; // "Nombre y apellidos"
  ContactPhone?: string | null;
  Email?: string | null;

  Active?: boolean;

  // variantes camelCase
  idSupplier?: number;
  rfc?: string;
  businessName?: string;

  street?: string;
  externalNumber?: string | null;
  internalNumber?: string | null;
  neighborhood?: string | null;
  postalCode?: number;

  city?: string | null;
  municipality?: string;
  state?: string;
  country?: string;

  phone?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  email?: string | null;

  active?: boolean;

  isActive?: boolean;
  IsActive?: boolean;

  [key: string]: unknown;
};

type FormDto = {
  rfc: string;
  businessName: string;

  street: string;
  externalNumber: string;
  internalNumber: string;
  neighborhood: string;
  postalCode: string; // UI

  city: string;
  municipality: string;
  state: string;
  country: string;

  phone: string;
  contactName: string; // "Nombre y apellidos"
  contactPhone: string;
  email: string;

  active: boolean;
};

type AuthStored = {
  token?: string;
  Token?: string;
};

type UnknownRecord = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const API_BASE = `${BASE_API}/api/Supplier`;

const initialForm: FormDto = {
  rfc: "",
  businessName: "",

  street: "",
  externalNumber: "",
  internalNumber: "",
  neighborhood: "",
  postalCode: "",

  city: "",
  municipality: "",
  state: "",
  country: "",

  phone: "",
  contactName: "",
  contactPhone: "",
  email: "",

  active: true,
};

/** =========================
 *  INPUT HELPERS (VALIDACIÓN + FORMATEO)
 *  ========================= */
function onlyLettersSpaces(v: string): string {
  // Letras con acentos/ñ, espacios, punto, guión y apóstrofe
  return v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.\-']/g, "");
}

function capitalizeWords(v: string): string {
  const clean = v.replace(/\s+/g, " ").trim().toLowerCase();
  if (!clean) return "";
  return clean
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRfc(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

function clampLen(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

export default function SupplierPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Supplier | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  // buscador
  const [search, setSearch] = useState("");

  // paginación (API)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // visual
  const [serverHasMore, setServerHasMore] = useState(true);

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
  const selectedRfc = useMemo(() => getRfc(selected), [selected]);

  useEffect(() => {
    void loadPage(1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadPage(page, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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

  function extractList(payload: unknown): Supplier[] {
    if (Array.isArray(payload)) return payload as Supplier[];
    if (isRecord(payload) && Array.isArray((payload as UnknownRecord).$values)) {
      return (payload as UnknownRecord).$values as Supplier[];
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

      if (Array.isArray(possible)) return possible as Supplier[];
    }

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as Supplier[];

    if (isRecord(payload)) return [payload as Supplier];
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

  async function loadPage(pageToLoad: number, keepSelectedRfc?: string | null) {
    setLoading(true);
    try {
      const token = readToken();
      if (!token) {
        showToast("error", "No hay token. Inicia sesión nuevamente.");
        setRows([]);
        return;
      }

      const result = await requestJson(`${API_BASE}?page=${pageToLoad}`, {
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

      // heurística: si devuelve menos de pageSize, asumimos que ya no hay más
      setServerHasMore(list.length >= pageSize);

      if (keepSelectedRfc) {
        const found =
          list.find((r) => (getRfc(r) ?? "").toUpperCase() === keepSelectedRfc.toUpperCase()) ?? null;
        setSelected(found);
        setMode("view");

        if (found && mode === "edit") {
          setFormEdit(formFromSupplier(found));
        }
      }
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function onRowClick(row: Supplier) {
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
    setFormEdit(formFromSupplier(selected));
    setMode("edit");
  }

  function toggleViewActiveInactive() {
    setShowInactive((prev) => !prev);
    setSelected(null);
    setMode("view");
  }

  /** ✅ VALIDACIONES PEDIDAS */
  function validateForm(f: FormDto): string {
    const rfc = normalizeRfc(f.rfc);
    if (!rfc) return "El RFC es obligatorio.";
    if (rfc.length < 12 || rfc.length > 13) return "El RFC debe tener 12 o 13 caracteres.";

    const bn = asTrim(f.businessName);
    if (!bn) return "La razón social es obligatoria.";
    if (bn.length < 3) return "La razón social es muy corta.";

    const street = asTrim(f.street);
    if (!street) return "La calle es obligatoria.";

    const cp = onlyDigits(f.postalCode);
    if (!cp) return "El código postal es obligatorio.";
    if (cp.length !== 5) return "El código postal debe tener 5 dígitos.";

    const mun = asTrim(f.municipality);
    if (!mun) return "El municipio es obligatorio.";
    if (/\d/.test(mun)) return "El municipio no debe contener números.";

    const st = asTrim(f.state);
    if (!st) return "El estado es obligatorio.";
    if (/\d/.test(st)) return "El estado no debe contener números.";

    const country = asTrim(f.country);
    if (!country) return "El país es obligatorio.";
    if (/\d/.test(country)) return "El país no debe contener números.";

    const contactName = asTrim(f.contactName);
    if (contactName && /\d/.test(contactName)) return "El nombre y apellidos no debe contener números.";

    const phone = onlyDigits(f.phone);
    if (phone && phone.length !== 10) return "El teléfono debe tener 10 dígitos.";

    const cphone = onlyDigits(f.contactPhone);
    if (cphone && cphone.length !== 10) return "El teléfono de contacto debe tener 10 dígitos.";

    const email = asTrim(f.email);
    if (email && !isValidEmail(email)) return "El correo no tiene un formato válido (debe incluir @ y .).";

    return "";
  }

  function supplierPayloadFromForm(f: FormDto): Supplier {
    return {
      IdSupplier: 0,
      Rfc: normalizeRfc(f.rfc),
      BusinessName: asTrim(f.businessName),

      Street: asTrim(f.street),
      ExternalNumber: asTrim(f.externalNumber) || null,
      InternalNumber: asTrim(f.internalNumber) || null,
      Neighborhood: asTrim(f.neighborhood) || null,
      PostalCode: Number(onlyDigits(f.postalCode)),

      City: asTrim(f.city) || null,
      Municipality: capitalizeWords(onlyLettersSpaces(f.municipality)),
      State: capitalizeWords(onlyLettersSpaces(f.state)),
      Country: capitalizeWords(onlyLettersSpaces(f.country)),

      Phone: onlyDigits(f.phone) || null,
      ContactName: capitalizeWords(onlyLettersSpaces(f.contactName)) || null,
      ContactPhone: onlyDigits(f.contactPhone) || null,
      Email: asTrim(f.email) || null,

      Active: Boolean(f.active),
    };
  }

  async function onCreate() {
    const msg = validateForm(formCreate);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        Supplier: supplierPayloadFromForm(formCreate),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Proveedor creado correctamente");
      setMode("view");
      const rfc = normalizeRfc(formCreate.rfc);
      setFormCreate(initialForm);

      await loadPage(page, rfc || null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected) return showToast("error", "Selecciona un proveedor para editar.");
    if (selectedId == null) return showToast("error", "No se pudo resolver el IdSupplier.");

    const msg = validateForm(formEdit);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const dto = supplierPayloadFromForm(formEdit);
      dto.IdSupplier = selectedId;

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(dto),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Proveedor actualizado correctamente");
      setMode("view");
      setSelected(null);
      await loadPage(page, null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(next: boolean) {
    if (!selected) return showToast("error", "Selecciona un proveedor.");
    const rfc = getRfc(selected);
    if (!rfc) return showToast("error", "No se pudo resolver el RFC.");

    setSaving(true);
    try {
      const result = await requestJson(`${API_BASE}/by-rfc/${encodeURIComponent(rfc)}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(next),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", `Proveedor ${next ? "activado" : "desactivado"} correctamente`);
      await loadPage(page, rfc);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onSearchByRfc() {
    const q = normalizeRfc(search);
    if (!q) return;

    setLoading(true);
    try {
      const result = await requestJson(`${API_BASE}/by-rfc/${encodeURIComponent(q)}`, {
        method: "GET",
        headers: authHeaders(),
      });

      if (!result.ok) {
        showToast("error", result.error);
        return;
      }

      const supplier = result.data as Supplier;
      setSelected(supplier);
      setMode("view");
      showToast("success", "Proveedor encontrado por RFC.");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
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

    return base.filter((s) => {
      const rfc = String(getRfc(s) ?? "").toLowerCase();
      const name = String(getBusinessName(s) ?? "").toLowerCase();
      const phone = String(getPhone(s) ?? "").toLowerCase();
      const email = String(getEmail(s) ?? "").toLowerCase();
      return rfc.includes(q) || name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [rows, search, showInactive]);

  const displayedRows = useMemo(() => {
    return filteredRows.slice(0, pageSize);
  }, [filteredRows, pageSize]);

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
            <h1 className={styles.h1}>Proveedores</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en la página actual (y puedes buscar RFC exacto)."
                : showInactive
                ? "Viendo proveedores inactivos."
                : "Viendo proveedores activos."}
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
              placeholder="Buscar por RFC, razón social, correo o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={saving || loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = normalizeRfc(search);
                  if (q.length === 12 || q.length === 13) void onSearchByRfc();
                }
              }}
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
              onClick={() => {
                const q = normalizeRfc(search);
                if (q.length === 12 || q.length === 13) void onSearchByRfc();
                else showToast("error", "Para buscar exacto, escribe un RFC de 12 o 13 caracteres y presiona Enter.");
              }}
              disabled={saving || loading || asTrim(search) === ""}
              title="Buscar por RFC exacto"
            >
              Buscar RFC
            </button>

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
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / ver
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

                <span className={styles.pagerInfo}>Pág {page}</span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={loading || saving || !serverHasMore}
                  onClick={() => setPage((p) => p + 1)}
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
                  <th style={{ width: 150 }}>RFC</th>
                  <th>Razón Social</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando proveedores...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron proveedores con esos criterios (en la página actual)."
                        : showInactive
                        ? "No hay proveedores inactivos en esta página."
                        : "No hay proveedores activos en esta página."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const rfc = getRfc(r);
                    const key = rfc ? rfc : `row-${idx}`;
                    const isSelected = selectedRfc && rfc && selectedRfc.toUpperCase() === rfc.toUpperCase();
                    const active = getActive(r) ?? false;

                    return (
                      <tr key={key} className={isSelected ? styles.rowSelected : styles.row} onClick={() => onRowClick(r)}>
                        <td className={styles.mono}>{rfc ?? "—"}</td>
                        <td>{getBusinessName(r) ?? "—"}</td>
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
              {mode === "create" ? "Nuevo proveedor" : mode === "edit" ? "Editar proveedor" : "Detalle"}
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
                  <Field label="RFC" required>
                    <input
                      className={styles.input}
                      value={formCreate.rfc}
                      onChange={(e) =>
                        setFormCreate((p) => ({ ...p, rfc: clampLen(normalizeRfc(e.target.value), 13) }))
                      }
                      disabled={createDisabled}
                      placeholder="XAXX010101000"
                      maxLength={13}
                    />
                  </Field>

                  <Field label="Razón social" required>
                    <input
                      className={styles.input}
                      value={formCreate.businessName}
                      onChange={(e) => setFormCreate((p) => ({ ...p, businessName: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Nombre / Razón social"
                    />
                  </Field>

                  <Field label="Calle" required>
                    <input
                      className={styles.input}
                      value={formCreate.street}
                      onChange={(e) => setFormCreate((p) => ({ ...p, street: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Calle"
                    />
                  </Field>

                  <Field label="No. exterior">
                    <input
                      className={styles.input}
                      value={formCreate.externalNumber}
                      onChange={(e) => setFormCreate((p) => ({ ...p, externalNumber: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Ej: 123"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="No. interior">
                    <input
                      className={styles.input}
                      value={formCreate.internalNumber}
                      onChange={(e) => setFormCreate((p) => ({ ...p, internalNumber: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Ej: 2B"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Colonia">
                    <input
                      className={styles.input}
                      value={formCreate.neighborhood}
                      onChange={(e) => setFormCreate((p) => ({ ...p, neighborhood: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="Colonia"
                    />
                  </Field>

                  <Field label="Código postal" required>
                    <input
                      className={styles.input}
                      value={formCreate.postalCode}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 5);
                        setFormCreate((p) => ({ ...p, postalCode: next }));
                      }}
                      disabled={createDisabled}
                      inputMode="numeric"
                      placeholder="Ej: 42800"
                      maxLength={5}
                    />
                  </Field>

                  <Field label="Ciudad">
                    <input
                      className={styles.input}
                      value={formCreate.city}
                      onChange={(e) =>
                        setFormCreate((p) => ({ ...p, city: capitalizeWords(onlyLettersSpaces(e.target.value)) }))
                      }
                      disabled={createDisabled}
                      placeholder="Ciudad"
                    />
                  </Field>

                  <Field label="Municipio" required>
                    <input
                      className={styles.input}
                      value={formCreate.municipality}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormCreate((p) => ({ ...p, municipality: capitalizeWords(cleaned) }));
                      }}
                      disabled={createDisabled}
                      placeholder="Municipio"
                    />
                  </Field>

                  <Field label="Estado" required>
                    <input
                      className={styles.input}
                      value={formCreate.state}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormCreate((p) => ({ ...p, state: capitalizeWords(cleaned) }));
                      }}
                      disabled={createDisabled}
                      placeholder="Estado"
                    />
                  </Field>

                  <Field label="País" required>
                    <input
                      className={styles.input}
                      value={formCreate.country}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormCreate((p) => ({ ...p, country: capitalizeWords(cleaned) }));
                      }}
                      disabled={createDisabled}
                      placeholder="País"
                    />
                  </Field>

                  <Field label="Teléfono (10 dígitos)">
                    <input
                      className={styles.input}
                      value={formCreate.phone}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 10);
                        setFormCreate((p) => ({ ...p, phone: next }));
                      }}
                      disabled={createDisabled}
                      inputMode="numeric"
                      placeholder="Ej: 7711234567"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Nombre y apellidos (Contacto)">
                    <input
                      className={styles.input}
                      value={formCreate.contactName}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormCreate((p) => ({ ...p, contactName: capitalizeWords(cleaned) }));
                      }}
                      disabled={createDisabled}
                      placeholder="Ej: Juan Pérez"
                    />
                  </Field>

                  <Field label="Teléfono contacto (10 dígitos)">
                    <input
                      className={styles.input}
                      value={formCreate.contactPhone}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 10);
                        setFormCreate((p) => ({ ...p, contactPhone: next }));
                      }}
                      disabled={createDisabled}
                      inputMode="numeric"
                      placeholder="Ej: 7711234567"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Correo">
                    <input
                      className={styles.input}
                      value={formCreate.email}
                      onChange={(e) => setFormCreate((p) => ({ ...p, email: e.target.value }))}
                      disabled={createDisabled}
                      placeholder="correo@dominio.com"
                      inputMode="email"
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
              <div className={styles.helper}>Selecciona un proveedor de la tabla para ver detalles.</div>
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
                    <span className={styles.detailLabel}>RFC</span>
                    <span className={styles.mono}>{String(selectedRfc ?? "—")}</span>
                  </div>

                  <Field label="Razón social" required>
                    <input
                      className={styles.input}
                      value={formEdit.businessName}
                      onChange={(e) => setFormEdit((p) => ({ ...p, businessName: e.target.value }))}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Calle" required>
                    <input
                      className={styles.input}
                      value={formEdit.street}
                      onChange={(e) => setFormEdit((p) => ({ ...p, street: e.target.value }))}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="No. exterior">
                    <input
                      className={styles.input}
                      value={formEdit.externalNumber}
                      onChange={(e) => setFormEdit((p) => ({ ...p, externalNumber: e.target.value }))}
                      disabled={saving || loading}
                      maxLength={10}
                    />
                  </Field>

                  <Field label="No. interior">
                    <input
                      className={styles.input}
                      value={formEdit.internalNumber}
                      onChange={(e) => setFormEdit((p) => ({ ...p, internalNumber: e.target.value }))}
                      disabled={saving || loading}
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Colonia">
                    <input
                      className={styles.input}
                      value={formEdit.neighborhood}
                      onChange={(e) => setFormEdit((p) => ({ ...p, neighborhood: e.target.value }))}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Código postal" required>
                    <input
                      className={styles.input}
                      value={formEdit.postalCode}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 5);
                        setFormEdit((p) => ({ ...p, postalCode: next }));
                      }}
                      disabled={saving || loading}
                      inputMode="numeric"
                      maxLength={5}
                    />
                  </Field>

                  <Field label="Ciudad">
                    <input
                      className={styles.input}
                      value={formEdit.city}
                      onChange={(e) =>
                        setFormEdit((p) => ({ ...p, city: capitalizeWords(onlyLettersSpaces(e.target.value)) }))
                      }
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Municipio" required>
                    <input
                      className={styles.input}
                      value={formEdit.municipality}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormEdit((p) => ({ ...p, municipality: capitalizeWords(cleaned) }));
                      }}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Estado" required>
                    <input
                      className={styles.input}
                      value={formEdit.state}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormEdit((p) => ({ ...p, state: capitalizeWords(cleaned) }));
                      }}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="País" required>
                    <input
                      className={styles.input}
                      value={formEdit.country}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormEdit((p) => ({ ...p, country: capitalizeWords(cleaned) }));
                      }}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Teléfono (10 dígitos)">
                    <input
                      className={styles.input}
                      value={formEdit.phone}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 10);
                        setFormEdit((p) => ({ ...p, phone: next }));
                      }}
                      disabled={saving || loading}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Nombre y apellidos (Contacto)">
                    <input
                      className={styles.input}
                      value={formEdit.contactName}
                      onChange={(e) => {
                        const cleaned = onlyLettersSpaces(e.target.value);
                        setFormEdit((p) => ({ ...p, contactName: capitalizeWords(cleaned) }));
                      }}
                      disabled={saving || loading}
                    />
                  </Field>

                  <Field label="Teléfono contacto (10 dígitos)">
                    <input
                      className={styles.input}
                      value={formEdit.contactPhone}
                      onChange={(e) => {
                        const next = clampLen(onlyDigits(e.target.value), 10);
                        setFormEdit((p) => ({ ...p, contactPhone: next }));
                      }}
                      disabled={saving || loading}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Field>

                  <Field label="Correo">
                    <input
                      className={styles.input}
                      value={formEdit.email}
                      onChange={(e) => setFormEdit((p) => ({ ...p, email: e.target.value }))}
                      disabled={saving || loading}
                      inputMode="email"
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
                  <span className={styles.detailLabel}>RFC</span>
                  <span className={styles.mono}>{String(selectedRfc ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Razón social</span>
                  <span className={styles.detailValue}>{String(getBusinessName(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Municipio</span>
                  <span className={styles.detailValue}>{String(getMunicipality(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Estado</span>
                  <span className={styles.detailValue}>{String(getState(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>País</span>
                  <span className={styles.detailValue}>{String(getCountry(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Correo</span>
                  <span className={styles.detailValue}>{String(getEmail(selected) ?? "—")}</span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Teléfono</span>
                  <span className={styles.detailValue}>{String(getPhone(selected) ?? "—")}</span>
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
                    onClick={() => onToggleStatus(!(getActive(selected) ?? false))}
                    disabled={saving || loading}
                    title="Activar/Desactivar por RFC (PATCH)"
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

/** Helpers (Supplier) */
function formFromSupplier(s: Supplier): FormDto {
  return {
    rfc: getRfc(s) ?? "",
    businessName: getBusinessName(s) ?? "",

    street: getStreet(s) ?? "",
    externalNumber: getExternalNumber(s) ?? "",
    internalNumber: getInternalNumber(s) ?? "",
    neighborhood: getNeighborhood(s) ?? "",
    postalCode: String(getPostalCode(s) ?? ""),

    city: getCity(s) ?? "",
    municipality: getMunicipality(s) ?? "",
    state: getState(s) ?? "",
    country: getCountry(s) ?? "",

    phone: getPhone(s) ?? "",
    contactName: getContactName(s) ?? "",
    contactPhone: getContactPhone(s) ?? "",
    email: getEmail(s) ?? "",

    active: getActive(s) ?? true,
  };
}

function getId(s: Supplier | null): number | null {
  if (!s) return null;
  const v = s.IdSupplier ?? s.idSupplier;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getRfc(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Rfc ?? s.rfc;
  const t = asTrim(v ?? "").toUpperCase();
  return t ? t : null;
}

function getBusinessName(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.BusinessName ?? s.businessName;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getStreet(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Street ?? s.street;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getExternalNumber(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.ExternalNumber ?? s.externalNumber;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getInternalNumber(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.InternalNumber ?? s.internalNumber;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getNeighborhood(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Neighborhood ?? s.neighborhood;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getPostalCode(s: Supplier | null): number | null {
  if (!s) return null;
  const v = s.PostalCode ?? s.postalCode;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCity(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.City ?? s.city;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getMunicipality(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Municipality ?? s.municipality;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getState(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.State ?? s.state;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getCountry(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Country ?? s.country;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getPhone(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Phone ?? s.phone;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getContactName(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.ContactName ?? s.contactName;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getContactPhone(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.ContactPhone ?? s.contactPhone;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getEmail(s: Supplier | null): string | null {
  if (!s) return null;
  const v = s.Email ?? s.email;
  const t = asTrim(v ?? "");
  return t ? t : null;
}

function getActive(s: Supplier | null): boolean | null {
  if (!s) return null;

  const v: unknown = s.Active ?? s.active ?? s.isActive ?? s.IsActive;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (typeof v === "string") {
    const t = asTrim(v).toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }

  return null;
}

/** Generic utils */
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
