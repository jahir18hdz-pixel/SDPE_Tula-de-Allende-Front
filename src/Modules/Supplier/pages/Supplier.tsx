import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import styles from "../styles/Suplier.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson } from "../../../services/api";

type SupplierType = "fisica" | "moral";

type Supplier = {
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
  ContactName?: string | null;
  ContactPhone?: string | null;
  Email?: string | null;

  Active?: boolean;

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
  supplierType: SupplierType;
  rfc: string;
  businessName: string;

  street: string;
  externalNumber: string;
  internalNumber: string;
  neighborhood: string;
  postalCode: string;

  city: string;
  municipality: string;
  state: string;
  country: string;

  phone: string;
  contactName: string;
  contactPhone: string;
  email: string;

  active: boolean;
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = "/api/Supplier";

const initialForm: FormDto = {
  supplierType: "moral",
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
 *  INPUT HELPERS
 *  ========================= */

function collapseSpaces(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

function onlyLettersSpaces(v: string): string {
  return v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.\-']/g, "");
}

function onlyAlphaNumeric(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, "");
}

function capitalizeWordsLoose(v: string): string {
  return v.replace(/\b([a-záéíóúüñ])/g, (m) => m.toUpperCase());
}

function normalizeHumanTextInput(v: string): string {
  const cleaned = onlyLettersSpaces(v);
  const singleSpaces = cleaned.replace(/\s{2,}/g, " ");
  return capitalizeWordsLoose(singleSpaces);
}

function normalizeGeneralTextInput(v: string): string {
  const singleSpaces = v.replace(/\s{2,}/g, " ");
  return capitalizeWordsLoose(singleSpaces);
}

function normalizeHumanTextForSave(v: string): string {
  return capitalizeWordsLoose(collapseSpaces(onlyLettersSpaces(v)).toLowerCase());
}

function normalizeGeneralTextForSave(v: string): string {
  return capitalizeWordsLoose(collapseSpaces(v).toLowerCase());
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRfc(v: string): string {
  return onlyAlphaNumeric(v).toUpperCase();
}

function clampLen(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

function getRfcLengthByType(type: SupplierType): number {
  return type === "moral" ? 12 : 13;
}

function inferSupplierTypeFromSupplier(s: Supplier | null): SupplierType {
  const rfc = getRfc(s) ?? "";
  const businessName = (getBusinessName(s) ?? "").trim().toLowerCase();

  if (businessName === "no aplica" && rfc.length === 13) return "fisica";
  if (rfc.length === 13) return "fisica";
  return "moral";
}

export default function SupplierPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Supplier | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void loadPage(1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadPage(page, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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

    const values = obj.$values;
    if (Array.isArray(values)) return values;

    const keys = [
      "data",
      "result",
      "items",
      "value",
      "values",
      "Items",
      "Data",
      "Result",
    ];
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
      const result = await requestJson(`${API_BASE}?page=${pageToLoad}`, {
        method: "GET",
      });

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const list = extractList(result.data);
      setRows(list);
      setServerHasMore(list.length >= pageSize);

      if (keepSelectedRfc) {
        const found =
          list.find(
            (r) =>
              (getRfc(r) ?? "").toUpperCase() === keepSelectedRfc.toUpperCase(),
          ) ?? null;
        setSelected(found);
        setMode("view");

        if (found && modeRef.current === "edit") {
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

  function validateForm(f: FormDto): string {
    const rfc = normalizeRfc(f.rfc);
    const rfcLen = getRfcLengthByType(f.supplierType);

    if (!rfc) return "El RFC es obligatorio.";
    if (!/^[A-Z0-9]+$/.test(rfc)) {
      return "El RFC solo debe contener letras y números.";
    }
    if (rfc.length !== rfcLen) {
      return `El RFC debe tener exactamente ${rfcLen} caracteres para persona ${f.supplierType === "moral" ? "moral" : "física"}.`;
    }

    if (f.supplierType === "moral") {
      const bn = collapseSpaces(f.businessName);
      if (!bn) return "La razón social es obligatoria.";
      if (bn.length < 3) return "La razón social es muy corta.";
    }

    const street = collapseSpaces(f.street);
    if (!street) return "La calle es obligatoria.";

    const cp = onlyDigits(f.postalCode);
    if (!cp) return "El código postal es obligatorio.";
    if (cp.length !== 5) return "El código postal debe tener 5 dígitos.";

    const city = collapseSpaces(f.city);
    if (city && /\d/.test(city)) {
      return "La ciudad no debe contener números.";
    }

    const mun = collapseSpaces(f.municipality);
    if (!mun) return "El municipio es obligatorio.";
    if (/\d/.test(mun)) return "El municipio no debe contener números.";

    const st = collapseSpaces(f.state);
    if (!st) return "El estado es obligatorio.";
    if (/\d/.test(st)) return "El estado no debe contener números.";

    const country = collapseSpaces(f.country);
    if (!country) return "El país es obligatorio.";
    if (/\d/.test(country)) return "El país no debe contener números.";

    const contactName = collapseSpaces(f.contactName);
    if (contactName && /\d/.test(contactName)) {
      return "El nombre y apellidos no debe contener números.";
    }

    const phone = onlyDigits(f.phone);
    if (phone && phone.length !== 10) {
      return "El teléfono debe tener 10 dígitos.";
    }

    const cphone = onlyDigits(f.contactPhone);
    if (cphone && cphone.length !== 10) {
      return "El teléfono de contacto debe tener 10 dígitos.";
    }

    const email = asTrim(f.email);
    if (email && !isValidEmail(email)) {
      return "El correo no tiene un formato válido (debe incluir @ y .).";
    }

    return "";
  }

  function supplierPayloadFromForm(f: FormDto): Supplier {
    return {
      IdSupplier: 0,
      Rfc: normalizeRfc(f.rfc),
      BusinessName:
        f.supplierType === "fisica"
          ? "No aplica"
          : normalizeGeneralTextForSave(f.businessName),

      Street: normalizeGeneralTextForSave(f.street),
      ExternalNumber: asTrim(f.externalNumber) || null,
      InternalNumber: asTrim(f.internalNumber) || null,
      Neighborhood: normalizeGeneralTextForSave(f.neighborhood) || null,
      PostalCode: Number(onlyDigits(f.postalCode)),

      City: normalizeHumanTextForSave(f.city) || null,
      Municipality: normalizeHumanTextForSave(f.municipality),
      State: normalizeHumanTextForSave(f.state),
      Country: normalizeHumanTextForSave(f.country),

      Phone: onlyDigits(f.phone) || null,
      ContactName: normalizeHumanTextForSave(f.contactName) || null,
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
    if (!selected) {
      return showToast("error", "Selecciona un proveedor para editar.");
    }
    if (selectedId == null) {
      return showToast("error", "No se pudo resolver el IdSupplier.");
    }

    const msg = validateForm(formEdit);
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const dto = supplierPayloadFromForm(formEdit);
      dto.IdSupplier = selectedId;

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify(dto),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Proveedor actualizado correctamente");
      setMode("view");

      const newRfc = normalizeRfc(formEdit.rfc);
      await loadPage(page, newRfc || null);
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
      const result = await requestJson(
        `${API_BASE}/by-rfc/${encodeURIComponent(rfc)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(next),
        },
      );

      if (!result.ok) return showToast("error", result.error);

      showToast(
        "success",
        `Proveedor ${next ? "activado" : "desactivado"} correctamente`,
      );
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
      const result = await requestJson(
        `${API_BASE}/by-rfc/${encodeURIComponent(q)}`,
        {
          method: "GET",
        },
      );

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
      return (
        rfc.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });
  }, [rows, search, showInactive]);

  const displayedRows = useMemo(
    () => filteredRows.slice(0, pageSize),
    [filteredRows, pageSize],
  );

  const formDisabled = saving || loading;
  const rfcSearchValid =
    normalizeRfc(search).length === 12 || normalizeRfc(search).length === 13;

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
              placeholder="Buscar por RFC, razón social, correo o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={formDisabled}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rfcSearchValid) {
                  void onSearchByRfc();
                }
              }}
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
              onClick={() => {
                const q = normalizeRfc(search);
                if (q.length === 12 || q.length === 13) void onSearchByRfc();
                else {
                  showToast(
                    "error",
                    "Para buscar exacto, escribe un RFC de 12 o 13 caracteres y presiona Enter.",
                  );
                }
              }}
              disabled={formDisabled || asTrim(search) === ""}
              title="Buscar por RFC exacto"
            >
              Buscar RFC
            </button>

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
              {mode === "create" ? "Creando..." : "+ Nuevo"}
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
                  disabled={formDisabled || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>

                <span className={styles.pagerInfo}>Pág {page}</span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={formDisabled || !serverHasMore}
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
                  <th>Razón social</th>
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
                    const isSelected =
                      !!selectedRfc &&
                      !!rfc &&
                      selectedRfc.toUpperCase() === rfc.toUpperCase();
                    const active = getActive(r) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td className={styles.mono}>{rfc ?? "—"}</td>
                        <td title={getBusinessName(r) ?? ""}>
                          {limitWords(getBusinessName(r), 10) ?? "—"}
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
                ? "Nuevo proveedor"
                : mode === "edit"
                  ? "Editar proveedor"
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
                <SupplierFormFields
                  form={formCreate}
                  setForm={setFormCreate}
                  formDisabled={formDisabled}
                />

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
              </form>
            ) : !selected ? (
              <div className={styles.helper}>
                Selecciona un proveedor de la tabla para ver detalles.
              </div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onUpdate();
                }}
              >
                <SupplierFormFields
                  form={formEdit}
                  setForm={setFormEdit}
                  formDisabled={formDisabled}
                />

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
              </form>
            ) : (
              <div className={styles.detailBox}>
                <div className={styles.detailCard}>
                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Tipo de persona</span>
                    <div className={styles.floatingValue}>
                      {inferSupplierTypeFromSupplier(selected) === "moral"
                        ? "Persona moral"
                        : "Persona física"}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>RFC</span>
                    <div className={styles.floatingValue}>
                      {String(selectedRfc ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Razón social</span>
                    <div className={styles.floatingValue}>
                      {String(getBusinessName(selected) ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Municipio</span>
                    <div className={styles.floatingValue}>
                      {String(getMunicipality(selected) ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Estado</span>
                    <div className={styles.floatingValue}>
                      {String(getState(selected) ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>País</span>
                    <div className={styles.floatingValue}>
                      {String(getCountry(selected) ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Correo</span>
                    <div className={styles.floatingValue}>
                      {String(getEmail(selected) ?? "—")}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Teléfono</span>
                    <div className={styles.floatingValue}>
                      {String(getPhone(selected) ?? "—")}
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
                    disabled={formDisabled}
                  >
                    Editar
                  </button>

                  <button
                    className={styles.btnDanger}
                    type="button"
                    onClick={() => onToggleStatus(!(getActive(selected) ?? false))}
                    disabled={formDisabled}
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

/** =========================
 * FORM FIELDS
 * ========================= */

type SupplierFormFieldsProps = {
  form: FormDto;
  setForm: Dispatch<SetStateAction<FormDto>>;
  formDisabled: boolean;
};

function SupplierFormFields({
  form,
  setForm,
  formDisabled,
}: SupplierFormFieldsProps) {
  const isFisica = form.supplierType === "fisica";
  const rfcMax = getRfcLengthByType(form.supplierType);

  return (
    <div className={styles.detailBox}>
      <div className={styles.detailCard}>
        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Tipo de persona</span>
          <select
            className={`${styles.floatingInput} ${styles.selectInput}`}
            value={form.supplierType}
            onChange={(e) => {
              const nextType = e.target.value as SupplierType;
              const nextRfcLen = getRfcLengthByType(nextType);

              setForm((p) => ({
                ...p,
                supplierType: nextType,
                rfc: clampLen(normalizeRfc(p.rfc), nextRfcLen),
                businessName:
                  nextType === "fisica"
                    ? "No aplica"
                    : p.businessName === "No aplica"
                      ? ""
                      : p.businessName,
              }));
            }}
            disabled={formDisabled}
          >
            <option value="moral">Persona moral</option>
            <option value="fisica">Persona física</option>
          </select>
        </div>

        <div className={styles.fieldHelp}>
          {isFisica
            ? "Persona física: el RFC debe tener 13 caracteres y la razón social se enviará como “No aplica”."
            : "Persona moral: el RFC debe tener 12 caracteres y la razón social es obligatoria."}
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>RFC</span>
          <input
            className={styles.floatingInput}
            value={form.rfc}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                rfc: clampLen(normalizeRfc(e.target.value), rfcMax),
              }))
            }
            disabled={formDisabled}
            placeholder={isFisica ? "RFC de 13 caracteres" : "RFC de 12 caracteres"}
            maxLength={rfcMax}
          />
        </div>

        {!isFisica && (
          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Razón social</span>
            <input
              className={styles.floatingInput}
              value={form.businessName}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  businessName: normalizeGeneralTextInput(e.target.value),
                }))
              }
              disabled={formDisabled}
              placeholder="Nombre / Razón social"
            />
          </div>
        )}

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Calle</span>
          <input
            className={styles.floatingInput}
            value={form.street}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                street: normalizeGeneralTextInput(e.target.value),
              }))
            }
            disabled={formDisabled}
            placeholder="Calle"
          />
        </div>

        <div className={styles.doubleRow}>
          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>No. exterior</span>
            <input
              className={styles.floatingInput}
              value={form.externalNumber}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  externalNumber: e.target.value,
                }))
              }
              disabled={formDisabled}
              placeholder="Ej: 123"
              maxLength={10}
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>No. interior</span>
            <input
              className={styles.floatingInput}
              value={form.internalNumber}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  internalNumber: e.target.value,
                }))
              }
              disabled={formDisabled}
              placeholder="Ej: 2B"
              maxLength={10}
            />
          </div>
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Colonia</span>
          <input
            className={styles.floatingInput}
            value={form.neighborhood}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                neighborhood: normalizeGeneralTextInput(e.target.value),
              }))
            }
            disabled={formDisabled}
            placeholder="Colonia"
          />
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Código postal</span>
          <input
            className={styles.floatingInput}
            value={form.postalCode}
            onChange={(e) => {
              const next = clampLen(onlyDigits(e.target.value), 5);
              setForm((p) => ({ ...p, postalCode: next }));
            }}
            disabled={formDisabled}
            inputMode="numeric"
            placeholder="Ej: 42800"
            maxLength={5}
          />
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Ciudad</span>
          <input
            className={styles.floatingInput}
            value={form.city}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                city: normalizeHumanTextInput(e.target.value),
              }))
            }
            disabled={formDisabled}
            placeholder="Ciudad"
          />
        </div>

        <div className={styles.doubleRow}>
          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Municipio</span>
            <input
              className={styles.floatingInput}
              value={form.municipality}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  municipality: normalizeHumanTextInput(e.target.value),
                }))
              }
              disabled={formDisabled}
              placeholder="Municipio"
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Estado</span>
            <input
              className={styles.floatingInput}
              value={form.state}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  state: normalizeHumanTextInput(e.target.value),
                }))
              }
              disabled={formDisabled}
              placeholder="Estado"
            />
          </div>
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>País</span>
          <input
            className={styles.floatingInput}
            value={form.country}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                country: normalizeHumanTextInput(e.target.value),
              }))
            }
            disabled={formDisabled}
            placeholder="País"
          />
        </div>

        <div className={styles.doubleRow}>
          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Teléfono</span>
            <input
              className={styles.floatingInput}
              value={form.phone}
              onChange={(e) => {
                const next = clampLen(onlyDigits(e.target.value), 10);
                setForm((p) => ({ ...p, phone: next }));
              }}
              disabled={formDisabled}
              inputMode="numeric"
              placeholder="Ej: 7711234567"
              maxLength={10}
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Teléfono contacto</span>
            <input
              className={styles.floatingInput}
              value={form.contactPhone}
              onChange={(e) => {
                const next = clampLen(onlyDigits(e.target.value), 10);
                setForm((p) => ({
                  ...p,
                  contactPhone: next,
                }));
              }}
              disabled={formDisabled}
              inputMode="numeric"
              placeholder="Ej: 7711234567"
              maxLength={10}
            />
          </div>
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>
            Nombre y apellidos (Contacto)
          </span>
          <input
            className={styles.floatingInput}
            value={form.contactName}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                contactName: normalizeHumanTextInput(e.target.value),
              }))
            }
            disabled={formDisabled}
            placeholder="Ej: Juan Carlos Pérez López"
          />
        </div>

        <div className={styles.floatingField}>
          <span className={styles.floatingLabel}>Correo</span>
          <input
            className={styles.floatingInput}
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                email: e.target.value,
              }))
            }
            disabled={formDisabled}
            placeholder="correo@dominio.com"
            inputMode="email"
          />
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Activo</span>
          <Switch
            checked={form.active}
            disabled={formDisabled}
            label={form.active ? "Activo" : "Inactivo"}
            onChange={(next) =>
              setForm((p) => ({ ...p, active: next }))
            }
          />
        </div>
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

/** Helpers (Supplier) */
function formFromSupplier(s: Supplier): FormDto {
  const supplierType = inferSupplierTypeFromSupplier(s);

  return {
    supplierType,
    rfc: getRfc(s) ?? "",
    businessName:
      supplierType === "fisica" ? "No aplica" : getBusinessName(s) ?? "",

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

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
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