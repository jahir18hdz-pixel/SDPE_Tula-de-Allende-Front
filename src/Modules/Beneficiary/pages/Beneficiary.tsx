import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../styles/Beneficiary.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson } from "../../../services/api";

type Beneficiary = {
  IdBeneficiary?: number;

  FirstName?: string;
  PaternalLastName?: string;
  MaternalLastName?: string | null;

  Street?: string;
  ExternalNumber?: string | null;
  InternalNumber?: string | null;
  Neighborhood?: string | null;
  PostalCode?: number;

  City?: string | null;
  Municipality?: string;
  State?: string;
  Country?: string;

  Ine?: string;
  Curp?: string;

  Phone?: string | null;
  Email?: string | null;

  Active?: boolean;

  idBeneficiary?: number;

  firstName?: string;
  paternalLastName?: string;
  maternalLastName?: string | null;

  street?: string;
  externalNumber?: string | null;
  internalNumber?: string | null;
  neighborhood?: string | null;
  postalCode?: number;

  city?: string | null;
  municipality?: string;
  state?: string;
  country?: string;

  ine?: string;
  curp?: string;

  phone?: string | null;
  email?: string | null;

  active?: boolean;

  [key: string]: unknown;
};

type FormDto = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;

  street: string;
  externalNumber: string;
  internalNumber: string;
  neighborhood: string;
  postalCode: string;

  city: string;
  municipality: string;
  state: string;
  country: string;

  ine: string;
  curp: string;

  phone: string;
  email: string;

  active: boolean;
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = "/api/Beneficiary";

const CURP_ALNUM_18 = /^[A-Z0-9]{18}$/;
const INE_MIN = 12;
const INE_MAX = 13;
const INE_REGEX = /^\d{12,13}$/;

const PHONE_LEN = 10;
const CP_LEN = 5;

const initialForm: FormDto = {
  firstName: "",
  paternalLastName: "",
  maternalLastName: "",

  street: "",
  externalNumber: "",
  internalNumber: "",
  neighborhood: "",
  postalCode: "",

  city: "",
  municipality: "",
  state: "",
  country: "México",

  ine: "",
  curp: "",

  phone: "",
  email: "",

  active: true,
};

export default function BeneficiaryPage() {
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Beneficiary | null>(null);
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
  const selectedCurp = useMemo(() => getCurp(selected), [selected]);

  const existingCurpSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = getCurp(r);
      if (c) set.add(asTrim(c).toUpperCase());
    }
    return set;
  }, [rows]);

  const modeRef = useRef<"view" | "create" | "edit">("view");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void loadAll(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function extractList(payload: unknown): Beneficiary[] {
    if (Array.isArray(payload)) return payload as Beneficiary[];
    if (isRecord(payload) && Array.isArray((payload as UnknownRecord).$values)) {
      return (payload as UnknownRecord).$values as Beneficiary[];
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

      if (Array.isArray(possible)) return possible as Beneficiary[];
    }

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as Beneficiary[];

    if (isRecord(payload)) return [payload as Beneficiary];
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

  async function loadAll(keepSelectedCurp?: string | null) {
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

      if (keepSelectedCurp) {
        const found =
          list.find(
            (r) =>
              (getCurp(r) ?? "").toUpperCase() === keepSelectedCurp.toUpperCase(),
          ) ?? null;
        setSelected(found);
        setMode("view");
        if (found && modeRef.current === "edit") {
          setFormEdit(toForm(found));
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

    return base.filter((b) => {
      const name = `${getFirstName(b) ?? ""} ${getPaternal(b) ?? ""} ${getMaternal(b) ?? ""}`
        .trim()
        .toLowerCase();
      const curp = String(getCurp(b) ?? "").toLowerCase();
      const ine = String(getIne(b) ?? "").toLowerCase();
      const muni = String(getMunicipality(b) ?? "").toLowerCase();
      return (
        name.includes(q) ||
        curp.includes(q) ||
        ine.includes(q) ||
        muni.includes(q)
      );
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

  function onRowClick(row: Beneficiary) {
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
    setFormEdit(toForm(selected));
    setMode("edit");
  }

  function toggleViewActiveInactive() {
    setShowInactive((prev) => !prev);
    setSelected(null);
    setMode("view");
    setPage(1);
  }

  function sanitizeLettersSpacesLive(v: string): string {
    return String(v ?? "").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "");
  }

  function normalizeLettersSpacesTitle(v: string): string {
    const raw = String(v ?? "")
      .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!raw) return "";

    return raw
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function normalizeUpperAlnum(v: string, maxLen: number): string {
    const t = asTrim(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return t.slice(0, maxLen);
  }

  function onlyDigits(v: string, maxLen: number): string {
    return asTrim(v).replace(/\D/g, "").slice(0, maxLen);
  }

  function normalizeEmail(v: string): string {
    return asTrim(v).toLowerCase();
  }

  function validateEmail(email: string): boolean {
    const t = asTrim(email);
    if (!t) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }

  function isDuplicateCurp(
    nextCurpUpper: string,
    currentId: number | null,
  ): boolean {
    for (const r of rows) {
      const c = (getCurp(r) ?? "").trim().toUpperCase();
      if (!c) continue;
      if (c !== nextCurpUpper) continue;

      const rid = getId(r);
      const sameRecord = currentId != null && rid != null && rid === currentId;
      if (!sameRecord) return true;
    }
    return false;
  }

  function validateForm(f: FormDto, opts?: { currentId: number | null }): string {
    const currentId = opts?.currentId ?? null;

    const name = normalizeLettersSpacesTitle(f.firstName);
    const pat = normalizeLettersSpacesTitle(f.paternalLastName);
    const mat = asTrim(f.maternalLastName)
      ? normalizeLettersSpacesTitle(f.maternalLastName)
      : "";

    if (!name) return "El nombre es obligatorio.";
    if (!pat) return "El apellido paterno es obligatorio.";
    if (name.length < 2) return "El nombre es muy corto.";
    if (pat.length < 2) return "El apellido paterno es muy corto.";
    if (mat && mat.length < 2) return "El apellido materno es muy corto.";

    const street = asTrim(f.street);
    if (!street || street.length < 3) {
      return "La calle es obligatoria (mínimo 3 caracteres).";
    }

    const cp = onlyDigits(f.postalCode, CP_LEN);
    if (cp.length !== CP_LEN) {
      return "El código postal debe tener exactamente 5 números.";
    }

    const municipality = normalizeLettersSpacesTitle(f.municipality);
    const state = normalizeLettersSpacesTitle(f.state);
    const country = normalizeLettersSpacesTitle(f.country);
    if (!municipality) return "El municipio es obligatorio.";
    if (!state) return "El estado es obligatorio.";
    if (!country) return "El país es obligatorio.";

    const ine = onlyDigits(f.ine, INE_MAX);
    if (ine.length < INE_MIN || ine.length > INE_MAX || !INE_REGEX.test(ine)) {
      return "El INE debe tener 12 ó 13 números (solo dígitos).";
    }

    const curp = normalizeUpperAlnum(f.curp, 18);
    if (curp.length !== 18) {
      return "La CURP debe tener exactamente 18 caracteres.";
    }
    if (!CURP_ALNUM_18.test(curp)) {
      return "La CURP debe ser alfanumérica (A-Z, 0-9) y sin espacios.";
    }
    if (existingCurpSet.size > 0 && isDuplicateCurp(curp, currentId)) {
      return "Esa CURP ya existe.";
    }

    const phone = onlyDigits(f.phone, PHONE_LEN);
    if (phone.length !== PHONE_LEN) {
      return "El teléfono debe tener exactamente 10 números.";
    }

    const email = normalizeEmail(f.email);
    if (email && !validateEmail(email)) {
      return "El correo no tiene un formato válido (ej: usuario@dominio.com).";
    }

    return "";
  }

  async function onCreate() {
    const msg = validateForm(formCreate, { currentId: null });
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        Beneficiary: {
          IdBeneficiary: 0,

          FirstName: normalizeLettersSpacesTitle(formCreate.firstName),
          PaternalLastName: normalizeLettersSpacesTitle(
            formCreate.paternalLastName,
          ),
          MaternalLastName: asTrim(formCreate.maternalLastName)
            ? normalizeLettersSpacesTitle(formCreate.maternalLastName)
            : null,

          Street: asTrim(formCreate.street),
          ExternalNumber: asTrim(formCreate.externalNumber) || null,
          InternalNumber: asTrim(formCreate.internalNumber) || null,
          Neighborhood: asTrim(formCreate.neighborhood) || null,
          PostalCode: Number(onlyDigits(formCreate.postalCode, CP_LEN)),

          City: asTrim(formCreate.city)
            ? normalizeLettersSpacesTitle(formCreate.city)
            : null,
          Municipality: normalizeLettersSpacesTitle(formCreate.municipality),
          State: normalizeLettersSpacesTitle(formCreate.state),
          Country: normalizeLettersSpacesTitle(formCreate.country),

          Ine: onlyDigits(formCreate.ine, INE_MAX),
          Curp: normalizeUpperAlnum(formCreate.curp, 18),

          Phone: onlyDigits(formCreate.phone, PHONE_LEN) || null,
          Email: normalizeEmail(formCreate.email) || null,

          Active: Boolean(formCreate.active),
        },
      };

      const createdCurp = normalizeUpperAlnum(formCreate.curp, 18);

      const result = await requestJson(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Beneficiario creado correctamente");
      setMode("view");
      setFormCreate(initialForm);
      await loadAll(createdCurp);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate() {
    if (!selected) {
      return showToast("error", "Selecciona un beneficiario para editar.");
    }
    if (selectedId == null) {
      return showToast("error", "No se pudo resolver el IdBeneficiary.");
    }

    const msg = validateForm(formEdit, { currentId: selectedId });
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const beneficiaryDto = {
        IdBeneficiary: selectedId,

        FirstName: normalizeLettersSpacesTitle(formEdit.firstName),
        PaternalLastName: normalizeLettersSpacesTitle(
          formEdit.paternalLastName,
        ),
        MaternalLastName: asTrim(formEdit.maternalLastName)
          ? normalizeLettersSpacesTitle(formEdit.maternalLastName)
          : null,

        Street: asTrim(formEdit.street),
        ExternalNumber: asTrim(formEdit.externalNumber) || null,
        InternalNumber: asTrim(formEdit.internalNumber) || null,
        Neighborhood: asTrim(formEdit.neighborhood) || null,
        PostalCode: Number(onlyDigits(formEdit.postalCode, CP_LEN)),

        City: asTrim(formEdit.city)
          ? normalizeLettersSpacesTitle(formEdit.city)
          : null,
        Municipality: normalizeLettersSpacesTitle(formEdit.municipality),
        State: normalizeLettersSpacesTitle(formEdit.state),
        Country: normalizeLettersSpacesTitle(formEdit.country),

        Ine: onlyDigits(formEdit.ine, INE_MAX),
        Curp: normalizeUpperAlnum(formEdit.curp, 18),

        Phone: onlyDigits(formEdit.phone, PHONE_LEN) || null,
        Email: normalizeEmail(formEdit.email) || null,

        Active: Boolean(formEdit.active),
      };

      const payload = {
        IdBeneficiary: selectedId,
        Beneficiary: beneficiaryDto,
      };

      const result = await requestJson(`${API_BASE}/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Beneficiario actualizado correctamente");
      setMode("view");
      setSelected(null);
      await loadAll(null);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const formDisabled = saving || loading;
  const setCreate = (patch: Partial<FormDto>) =>
    setFormCreate((p) => ({ ...p, ...patch }));
  const patchEdit = (patch: Partial<FormDto>) =>
    setFormEdit((p) => ({ ...p, ...patch }));

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
            <h1 className={styles.h1}>Beneficiarios</h1>
            <p className={styles.sub}>
              {asTrim(search)
                ? "Buscando en activos e inactivos."
                : showInactive
                  ? "Viendo beneficiarios inactivos."
                  : "Viendo beneficiarios activos."}
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
              placeholder="Buscar por nombre, CURP, INE o municipio…"
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
                  <th>Nombre</th>
                  <th style={{ width: 190 }}>CURP</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      Cargando beneficiarios...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      {asTrim(search)
                        ? "No se encontraron beneficiarios (activos o inactivos) con esos criterios."
                        : showInactive
                          ? "No hay beneficiarios inactivos."
                          : "No hay beneficiarios activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const curp = getCurp(r);
                    const key = curp ? String(curp) : `row-${idx}`;
                    const isSelected =
                      selectedCurp != null &&
                      curp != null &&
                      curp.toUpperCase() === selectedCurp.toUpperCase();

                    const active = getActive(r) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(r)}
                      >
                        <td title={formatFullName(r)}>
                          {limitWords(formatFullName(r), 10) || "—"}
                        </td>
                        <td className={styles.mono}>{curp ?? "—"}</td>
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
                ? "Nuevo beneficiario"
                : mode === "edit"
                  ? "Editar beneficiario"
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
                    <div className={styles.sectionTitle}>Identidad</div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Nombre(s)</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.firstName}
                          onChange={(e) =>
                            setCreate({
                              firstName: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            setCreate({
                              firstName: normalizeLettersSpacesTitle(
                                formCreate.firstName,
                              ),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="Ej: Juan Carlos"
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          Apellido paterno
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.paternalLastName}
                          onChange={(e) =>
                            setCreate({
                              paternalLastName: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            setCreate({
                              paternalLastName: normalizeLettersSpacesTitle(
                                formCreate.paternalLastName,
                              ),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="Ej: Pérez"
                        />
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Apellido materno
                      </span>
                      <input
                        className={styles.floatingInput}
                        value={formCreate.maternalLastName}
                        onChange={(e) =>
                          setCreate({
                            maternalLastName: sanitizeLettersSpacesLive(
                              e.target.value,
                            ),
                          })
                        }
                        onBlur={() =>
                          setCreate({
                            maternalLastName: normalizeLettersSpacesTitle(
                              formCreate.maternalLastName,
                            ),
                          })
                        }
                        disabled={formDisabled}
                        placeholder="Ej: López"
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>CURP</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.curp}
                          onChange={(e) =>
                            setCreate({
                              curp: normalizeUpperAlnum(e.target.value, 18),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="18 caracteres"
                          maxLength={18}
                          autoCapitalize="characters"
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>INE</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.ine}
                          onChange={(e) =>
                            setCreate({
                              ine: onlyDigits(e.target.value, INE_MAX),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="12 o 13 dígitos"
                          maxLength={INE_MAX}
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    <div className={styles.sectionTitle}>Contacto</div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Teléfono</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.phone}
                          onChange={(e) =>
                            setCreate({
                              phone: onlyDigits(e.target.value, PHONE_LEN),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="10 dígitos"
                          inputMode="numeric"
                          maxLength={PHONE_LEN}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Email</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.email}
                          onChange={(e) =>
                            setCreate({
                              email: normalizeEmail(e.target.value),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="usuario@dominio.com"
                          inputMode="email"
                        />
                      </div>
                    </div>

                    <div className={styles.sectionTitle}>Domicilio</div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Calle</span>
                      <input
                        className={styles.floatingInput}
                        value={formCreate.street}
                        onChange={(e) => setCreate({ street: e.target.value })}
                        disabled={formDisabled}
                        placeholder="Calle"
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          No. exterior
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.externalNumber}
                          onChange={(e) =>
                            setCreate({ externalNumber: e.target.value })
                          }
                          disabled={formDisabled}
                          placeholder="Ej: 12"
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          No. interior
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.internalNumber}
                          onChange={(e) =>
                            setCreate({ internalNumber: e.target.value })
                          }
                          disabled={formDisabled}
                          placeholder="Ej: 2B"
                        />
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Colonia</span>
                      <input
                        className={styles.floatingInput}
                        value={formCreate.neighborhood}
                        onChange={(e) =>
                          setCreate({ neighborhood: e.target.value })
                        }
                        disabled={formDisabled}
                        placeholder="Colonia"
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          Código postal
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.postalCode}
                          onChange={(e) =>
                            setCreate({
                              postalCode: onlyDigits(e.target.value, CP_LEN),
                            })
                          }
                          disabled={formDisabled}
                          inputMode="numeric"
                          placeholder="5 dígitos"
                          maxLength={CP_LEN}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Ciudad</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.city}
                          onChange={(e) =>
                            setCreate({
                              city: sanitizeLettersSpacesLive(e.target.value),
                            })
                          }
                          onBlur={() =>
                            setCreate({
                              city: normalizeLettersSpacesTitle(formCreate.city),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="Ej: Tula de Allende"
                        />
                      </div>
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Municipio</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.municipality}
                          onChange={(e) =>
                            setCreate({
                              municipality: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            setCreate({
                              municipality: normalizeLettersSpacesTitle(
                                formCreate.municipality,
                              ),
                            })
                          }
                          disabled={formDisabled}
                          placeholder="Municipio"
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Estado</span>
                        <input
                          className={styles.floatingInput}
                          value={formCreate.state}
                          onChange={(e) =>
                            setCreate({
                              state: sanitizeLettersSpacesLive(e.target.value),
                            })
                          }
                          onBlur={() =>
                            setCreate({
                              state: normalizeLettersSpacesTitle(
                                formCreate.state,
                              ),
                            })
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
                        value={formCreate.country}
                        onChange={(e) =>
                          setCreate({
                            country: sanitizeLettersSpacesLive(e.target.value),
                          })
                        }
                        onBlur={() =>
                          setCreate({
                            country: normalizeLettersSpacesTitle(
                              formCreate.country,
                            ),
                          })
                        }
                        disabled={formDisabled}
                        placeholder="País"
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={formCreate.active}
                        disabled={formDisabled}
                        label={formCreate.active ? "Activo" : "Inactivo"}
                        onChange={(next) => setCreate({ active: next })}
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
                Selecciona un beneficiario de la tabla para ver detalles.
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
                    <div className={styles.sectionTitle}>Identidad</div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Nombre(s)</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.firstName}
                          onChange={(e) =>
                            patchEdit({
                              firstName: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            patchEdit({
                              firstName: normalizeLettersSpacesTitle(
                                formEdit.firstName,
                              ),
                            })
                          }
                          disabled={formDisabled}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          Apellido paterno
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.paternalLastName}
                          onChange={(e) =>
                            patchEdit({
                              paternalLastName: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            patchEdit({
                              paternalLastName: normalizeLettersSpacesTitle(
                                formEdit.paternalLastName,
                              ),
                            })
                          }
                          disabled={formDisabled}
                        />
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Apellido materno
                      </span>
                      <input
                        className={styles.floatingInput}
                        value={formEdit.maternalLastName}
                        onChange={(e) =>
                          patchEdit({
                            maternalLastName: sanitizeLettersSpacesLive(
                              e.target.value,
                            ),
                          })
                        }
                        onBlur={() =>
                          patchEdit({
                            maternalLastName: normalizeLettersSpacesTitle(
                              formEdit.maternalLastName,
                            ),
                          })
                        }
                        disabled={formDisabled}
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>CURP</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.curp}
                          onChange={(e) =>
                            patchEdit({
                              curp: normalizeUpperAlnum(e.target.value, 18),
                            })
                          }
                          disabled={formDisabled}
                          maxLength={18}
                          autoCapitalize="characters"
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>INE</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.ine}
                          onChange={(e) =>
                            patchEdit({
                              ine: onlyDigits(e.target.value, INE_MAX),
                            })
                          }
                          disabled={formDisabled}
                          maxLength={INE_MAX}
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    <div className={styles.sectionTitle}>Contacto</div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Teléfono</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.phone}
                          onChange={(e) =>
                            patchEdit({
                              phone: onlyDigits(e.target.value, PHONE_LEN),
                            })
                          }
                          disabled={formDisabled}
                          inputMode="numeric"
                          maxLength={PHONE_LEN}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Email</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.email}
                          onChange={(e) =>
                            patchEdit({
                              email: normalizeEmail(e.target.value),
                            })
                          }
                          disabled={formDisabled}
                          inputMode="email"
                        />
                      </div>
                    </div>

                    <div className={styles.sectionTitle}>Domicilio</div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Calle</span>
                      <input
                        className={styles.floatingInput}
                        value={formEdit.street}
                        onChange={(e) => patchEdit({ street: e.target.value })}
                        disabled={formDisabled}
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          No. exterior
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.externalNumber}
                          onChange={(e) =>
                            patchEdit({ externalNumber: e.target.value })
                          }
                          disabled={formDisabled}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          No. interior
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.internalNumber}
                          onChange={(e) =>
                            patchEdit({ internalNumber: e.target.value })
                          }
                          disabled={formDisabled}
                        />
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Colonia</span>
                      <input
                        className={styles.floatingInput}
                        value={formEdit.neighborhood}
                        onChange={(e) =>
                          patchEdit({ neighborhood: e.target.value })
                        }
                        disabled={formDisabled}
                      />
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>
                          Código postal
                        </span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.postalCode}
                          onChange={(e) =>
                            patchEdit({
                              postalCode: onlyDigits(e.target.value, CP_LEN),
                            })
                          }
                          disabled={formDisabled}
                          inputMode="numeric"
                          maxLength={CP_LEN}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Ciudad</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.city}
                          onChange={(e) =>
                            patchEdit({
                              city: sanitizeLettersSpacesLive(e.target.value),
                            })
                          }
                          onBlur={() =>
                            patchEdit({
                              city: normalizeLettersSpacesTitle(formEdit.city),
                            })
                          }
                          disabled={formDisabled}
                        />
                      </div>
                    </div>

                    <div className={styles.doubleRow}>
                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Municipio</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.municipality}
                          onChange={(e) =>
                            patchEdit({
                              municipality: sanitizeLettersSpacesLive(
                                e.target.value,
                              ),
                            })
                          }
                          onBlur={() =>
                            patchEdit({
                              municipality: normalizeLettersSpacesTitle(
                                formEdit.municipality,
                              ),
                            })
                          }
                          disabled={formDisabled}
                        />
                      </div>

                      <div className={styles.floatingField}>
                        <span className={styles.floatingLabel}>Estado</span>
                        <input
                          className={styles.floatingInput}
                          value={formEdit.state}
                          onChange={(e) =>
                            patchEdit({
                              state: sanitizeLettersSpacesLive(e.target.value),
                            })
                          }
                          onBlur={() =>
                            patchEdit({
                              state: normalizeLettersSpacesTitle(formEdit.state),
                            })
                          }
                          disabled={formDisabled}
                        />
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>País</span>
                      <input
                        className={styles.floatingInput}
                        value={formEdit.country}
                        onChange={(e) =>
                          patchEdit({
                            country: sanitizeLettersSpacesLive(e.target.value),
                          })
                        }
                        onBlur={() =>
                          patchEdit({
                            country: normalizeLettersSpacesTitle(
                              formEdit.country,
                            ),
                          })
                        }
                        disabled={formDisabled}
                      />
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={formEdit.active}
                        disabled={formDisabled}
                        label={formEdit.active ? "Activo" : "Inactivo"}
                        onChange={(next) => patchEdit({ active: next })}
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
                  <div className={styles.sectionTitle}>Identidad</div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Nombre</span>
                    <div className={styles.floatingValue}>
                      {formatFullName(selected) || "—"}
                    </div>
                  </div>

                  <div className={styles.doubleRow}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>CURP</span>
                      <div className={`${styles.floatingValue} ${styles.mono}`}>
                        {String(getCurp(selected) ?? "—")}
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>INE</span>
                      <div className={styles.floatingValue}>
                        {String(getIne(selected) ?? "—")}
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionTitle}>Contacto</div>

                  <div className={styles.doubleRow}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Teléfono</span>
                      <div className={styles.floatingValue}>
                        {String(getPhone(selected) ?? "—")}
                      </div>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Email</span>
                      <div className={styles.floatingValue}>
                        {String(getEmail(selected) ?? "—")}
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionTitle}>Domicilio</div>

                  <div className={styles.floatingFieldArea}>
                    <span className={styles.floatingLabel}>Dirección</span>
                    <div className={styles.floatingValueArea}>
                      {formatAddress(selected) || "—"}
                    </div>
                  </div>

                  <div className={styles.doubleRow}>
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

function toForm(b: Beneficiary): FormDto {
  return {
    firstName: asTrim(getFirstName(b) ?? ""),
    paternalLastName: asTrim(getPaternal(b) ?? ""),
    maternalLastName: asTrim(getMaternal(b) ?? ""),

    street: asTrim(getStreet(b) ?? ""),
    externalNumber: asTrim(getExternalNumber(b) ?? ""),
    internalNumber: asTrim(getInternalNumber(b) ?? ""),
    neighborhood: asTrim(getNeighborhood(b) ?? ""),
    postalCode: String(getPostalCode(b) ?? ""),

    city: asTrim(getCity(b) ?? ""),
    municipality: asTrim(getMunicipality(b) ?? ""),
    state: asTrim(getState(b) ?? ""),
    country: asTrim(getCountry(b) ?? "México"),

    ine: asTrim(getIne(b) ?? ""),
    curp: asTrim(getCurp(b) ?? ""),

    phone: asTrim(getPhone(b) ?? ""),
    email: asTrim(getEmail(b) ?? ""),

    active: getActive(b) ?? true,
  };
}

function getId(b: Beneficiary | null): number | null {
  if (!b) return null;
  const v = b.IdBeneficiary ?? b.idBeneficiary;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function getFirstName(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.FirstName ?? b.firstName;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getPaternal(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.PaternalLastName ?? b.paternalLastName;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getMaternal(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.MaternalLastName ?? b.maternalLastName;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getStreet(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Street ?? b.street;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getExternalNumber(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.ExternalNumber ?? b.externalNumber;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getInternalNumber(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.InternalNumber ?? b.internalNumber;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getNeighborhood(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Neighborhood ?? b.neighborhood;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getPostalCode(b: Beneficiary | null): number | null {
  if (!b) return null;
  const v = b.PostalCode ?? b.postalCode;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function getCity(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.City ?? b.city;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getMunicipality(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Municipality ?? b.municipality;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getState(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.State ?? b.state;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getCountry(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Country ?? b.country;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getIne(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Ine ?? b.ine;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getCurp(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Curp ?? b.curp;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getPhone(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Phone ?? b.phone;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getEmail(b: Beneficiary | null): string | null {
  if (!b) return null;
  const v = b.Email ?? b.email;
  const s = asTrim(v ?? "");
  return s ? s : null;
}
function getActive(b: Beneficiary | null): boolean | null {
  if (!b) return null;
  const v: unknown = b.Active ?? b.active;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = asTrim(v).toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return null;
}

function formatFullName(b: Beneficiary): string {
  const n = getFirstName(b) ?? "";
  const p = getPaternal(b) ?? "";
  const m = getMaternal(b) ?? "";
  return `${n} ${p} ${m}`.replace(/\s+/g, " ").trim();
}
function formatAddress(b: Beneficiary): string {
  const street = getStreet(b) ?? "";
  const ext = getExternalNumber(b) ?? "";
  const intr = getInternalNumber(b) ?? "";
  const neigh = getNeighborhood(b) ?? "";
  const pc = getPostalCode(b) ?? "";

  const nums = [ext ? `Ext. ${ext}` : "", intr ? `Int. ${intr}` : ""]
    .filter(Boolean)
    .join(" ");
  const part1 = [street, nums].filter(Boolean).join(", ");
  const part2 = [neigh ? `Col. ${neigh}` : "", pc ? `CP ${pc}` : ""]
    .filter(Boolean)
    .join(", ");

  return [part1, part2].filter(Boolean).join(" • ").trim();
}

function limitWords(text: string | null, maxWords: number): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

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
function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error inesperado.";
  }
}