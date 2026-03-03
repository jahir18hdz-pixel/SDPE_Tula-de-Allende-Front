import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AcquisitionRequest.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type CatalogItem = { id: number; name: string };

type CreateForm = {
  requestNumber: string;
  requestDate: string; // yyyy-mm-dd
  justification: string;
  authorizationDate: string; // yyyy-mm-dd
  observations: string;

  idAdministrativeUnit: number | null;
  idProject: number | null;
  idAcquisitionType: number | null;
  idSupplier: number | null;

  idFundingSource: number | null;
  idAcquisitionClassification: number | null;
  idProgram: number | null;
  idCommunity: number | null;
  idBeneficiary: number | null;
};

const API_BASE = "/api/AcquisitionRequest";

/**
 * ✅ Rutas exactas por tus controllers (Route("api/[controller]"))
 */
const CATALOG_ENDPOINTS = {
  administrativeUnits: "/api/AdministrativeUnit",
  projects: "/api/Proyect",
  acquisitionTypes: "/api/AcquisitionType",
  suppliers: "/api/Supplier",
  fundingSources: "/api/FundingSource",
  acquisitionClassifications: "/api/AcquisitionClassification",
  programs: "/api/Prog",
  communities: "/api/Community",
  beneficiaries: "/api/Beneficiary",
} as const;

const initialCreate: CreateForm = {
  requestNumber: "",
  requestDate: "",
  justification: "",
  authorizationDate: "",
  observations: "",

  idAdministrativeUnit: null,
  idProject: null,
  idAcquisitionType: null,
  idSupplier: null,

  idFundingSource: null,
  idAcquisitionClassification: null,
  idProgram: null,
  idCommunity: null,
  idBeneficiary: null,
};

type NormalizeOpts = {
  idKeys?: readonly string[];
  nameKeys?: readonly string[];
};

export default function AcquisitionRequest() {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [create, setCreate] = useState<CreateForm>(initialCreate);

  const [loadingCats, setLoadingCats] = useState(false);

  const [administrativeUnits, setAdministrativeUnits] = useState<CatalogItem[]>([]);
  const [projects, setProjects] = useState<CatalogItem[]>([]);
  const [acquisitionTypes, setAcquisitionTypes] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogItem[]>([]);
  const [fundingSources, setFundingSources] = useState<CatalogItem[]>([]);
  const [acqClassifications, setAcqClassifications] = useState<CatalogItem[]>([]);
  const [programs, setPrograms] = useState<CatalogItem[]>([]);
  const [communities, setCommunities] = useState<CatalogItem[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<CatalogItem[]>([]);

  // toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const requestDateRef = useRef<HTMLInputElement | null>(null);
  const authDateRef = useRef<HTMLInputElement | null>(null);

  const createDisabled = saving || loadingCats;

  // -----------------------------
  // Cargar catálogos (con normalizadores específicos cuando hace falta)
  // -----------------------------
  const loadCatalogGeneric = useCallback(
    async (url: string, label: string, opts?: NormalizeOpts): Promise<CatalogItem[]> => {
      const result = await requestJson(url, { method: "GET", headers: authHeaders() });
      if (!result.ok) throw new Error(`${label}: ${result.error}`);
      return normalizeCatalog(result.data, opts);
    },
    []
  );

  const loadProjects = useCallback(async (): Promise<CatalogItem[]> => {
    const result = await requestJson(CATALOG_ENDPOINTS.projects, { method: "GET", headers: authHeaders() });
    if (!result.ok) throw new Error(`Proyectos: ${result.error}`);

    // Swagger:
    // { idProyect, code, description, active }
    return normalizeCatalog(result.data, {
      idKeys: ["idProyect", "IdProyect", "id", "Id"],
      nameKeys: ["description", "Description", "name", "Name"],
    });
  }, []);

  const loadBeneficiaries = useCallback(async (): Promise<CatalogItem[]> => {
    const result = await requestJson(CATALOG_ENDPOINTS.beneficiaries, { method: "GET", headers: authHeaders() });
    if (!result.ok) throw new Error(`Beneficiarios: ${result.error}`);

    // Swagger:
    // { idBeneficiary, firstName, paternalLastName, maternalLastName, communityName, ... }
    const payload = result.data;

    const list: unknown[] = Array.isArray(payload)
      ? payload
      : isRecord(payload)
        ? asArray(getValue(payload, ["items", "Items", "data", "Data", "result", "Result"]))
        : [];

    return list
      .map((raw): CatalogItem | null => {
        if (!isRecord(raw)) return null;

        const id = toNumber(getValue(raw, ["idBeneficiary", "IdBeneficiary", "id", "Id"]));
        if (!id || id <= 0) return null;

        const firstName = toStringSafe(getValue(raw, ["firstName", "FirstName"])).trim();
        const paternal = toStringSafe(getValue(raw, ["paternalLastName", "PaternalLastName"])).trim();
        const maternal = toStringSafe(getValue(raw, ["maternalLastName", "MaternalLastName"])).trim();
        const community = toStringSafe(getValue(raw, ["communityName", "CommunityName"])).trim();

        const full = [firstName, paternal, maternal].filter(Boolean).join(" ").trim();
        const label = community ? `${full} — ${community}` : full;

        if (!label) return null;
        return { id, name: label };
      })
      .filter((x): x is CatalogItem => x !== null);
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoadingCats(true);

      const tasks = [
        {
          key: "administrativeUnits",
          label: "Unidades administrativas",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.administrativeUnits, "Unidades administrativas", {
              idKeys: ["idAdministrativeUnit", "IdAdministrativeUnit", "id", "Id"],
              nameKeys: ["description", "Description", "name", "Name"],
            }),
        },
        {
          key: "projects",
          label: "Proyectos",
          run: () => loadProjects(),
        },
        {
          key: "acquisitionTypes",
          label: "Tipos de adquisición",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.acquisitionTypes, "Tipos de adquisición", {
              idKeys: ["idAcquisitionType", "IdAcquisitionType", "id", "Id"],
              nameKeys: ["description", "Description", "name", "Name", "typeName", "TypeName"],
            }),
        },
        {
          key: "suppliers",
          label: "Proveedores",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.suppliers, "Proveedores", {
              idKeys: ["idSupplier", "IdSupplier", "id", "Id"],
              nameKeys: ["supplierName", "SupplierName", "businessName", "BusinessName", "name", "Name", "description", "Description"],
            }),
        },
        {
          key: "fundingSources",
          label: "Fuentes de financiamiento",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.fundingSources, "Fuentes de financiamiento", {
              idKeys: ["idFundingSource", "IdFundingSource", "id", "Id"],
              nameKeys: ["description", "Description", "name", "Name", "sourceName", "SourceName"],
            }),
        },
        {
          key: "acqClassifications",
          label: "Clasificación de adquisición",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.acquisitionClassifications, "Clasificación de adquisición", {
              idKeys: ["idAcquisitionClassification", "IdAcquisitionClassification", "id", "Id"],
              nameKeys: [
                "description",
                "Description",
                "classificationName",
                "ClassificationName",
                "acquisitionClassification",
                "AcquisitionClassification",
                "name",
                "Name",
              ],
            }),
        },
        {
          key: "programs",
          label: "Programas",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.programs, "Programas", {
              idKeys: ["idProgram", "IdProgram", "id", "Id", "idProg", "IdProg"],
              nameKeys: ["description", "Description", "programName", "ProgramName", "name", "Name"],
            }),
        },
        {
          key: "communities",
          label: "Comunidades",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.communities, "Comunidades", {
              idKeys: ["idCommunity", "IdCommunity", "id", "Id"],
              nameKeys: ["communityName", "CommunityName", "description", "Description", "name", "Name"],
            }),
        },
        {
          key: "beneficiaries",
          label: "Beneficiarios",
          run: () => loadBeneficiaries(),
        },
      ] as const;

      const results = await Promise.allSettled(tasks.map((t) => t.run()));
      if (!alive) return;

      results.forEach((r, i) => {
        const t = tasks[i];

        if (r.status === "fulfilled") {
          const list = r.value;

          switch (t.key) {
            case "administrativeUnits":
              setAdministrativeUnits(list);
              break;
            case "projects":
              setProjects(list);
              break;
            case "acquisitionTypes":
              setAcquisitionTypes(list);
              break;
            case "suppliers":
              setSuppliers(list);
              break;
            case "fundingSources":
              setFundingSources(list);
              break;
            case "acqClassifications":
              setAcqClassifications(list);
              break;
            case "programs":
              setPrograms(list);
              break;
            case "communities":
              setCommunities(list);
              break;
            case "beneficiaries":
              setBeneficiaries(list);
              break;
          }
        } else {
          showToast("error", r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
      });

      setLoadingCats(false);
    }

    void run();
    return () => {
      alive = false;
    };
  }, [loadCatalogGeneric, loadProjects, loadBeneficiaries, showToast]);

  // -----------------------------
  // Validación + Guardar
  // -----------------------------
  function validateCreate(): string {
    const req = create.requestNumber.trim();
    const date = create.requestDate.trim();
    const just = create.justification.trim();

    if (!req) return "El número de solicitud es obligatorio.";
    if (req.length < 2) return "El número de solicitud es demasiado corto.";
    if (!date) return "La fecha de solicitud es obligatoria.";
    if (!just) return "La justificación es obligatoria.";
    if (just.length < 5) return "La justificación es demasiado corta.";
    return "";
  }

  async function onCreate() {
    const msg = validateCreate();
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        requestNumber: create.requestNumber.trim() || null,
        requestDate: toNullableIsoDate(create.requestDate),
        justification: create.justification.trim() || null,
        authorizationDate: toNullableIsoDate(create.authorizationDate),
        observations: create.observations.trim() || null,

        idAdministrativeUnit: create.idAdministrativeUnit,
        idProject: create.idProject,
        idAcquisitionType: create.idAcquisitionType,
        idSupplier: create.idSupplier,

        // ✅ backend lo asigna
        idApplicationStatus: 0,

        idFundingSource: create.idFundingSource,
        idAcquisitionClassification: create.idAcquisitionClassification,
        idProgram: create.idProgram,
        idCommunity: create.idCommunity,
        idBeneficiary: create.idBeneficiary,
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Solicitud de adquisición registrada.");
      setCreate(initialCreate);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------
  // Calendario: showPicker sin any
  // -----------------------------
  type DatePickerInput = HTMLInputElement & { showPicker?: () => void };

  function openDatePicker(ref: React.RefObject<HTMLInputElement | null>) {
    const el = ref.current as DatePickerInput | null;
    if (!el) return;

    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }

    el.focus();
    el.click();
  }

  const headerHint = useMemo(() => (loadingCats ? "Cargando catálogos..." : "Completa los campos y guarda la solicitud."), [loadingCats]);

  return (
    <div className={styles.page}>
      <Toast open={toastOpen} type={toastType} message={toastMsg} onClose={() => setToastOpen(false)} durationMs={3200} />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Registro de adquisición</h1>
            <p className={styles.sub}>{headerHint}</p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.btnGhost} type="button" onClick={() => navigate("/home")} disabled={saving} title="Regresar al home">
              Volver al inicio
            </button>

            <button className={styles.btnGhost} type="button" onClick={() => setCreate(initialCreate)} disabled={createDisabled} title="Limpiar formulario">
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>Nueva solicitud</p>
        </div>

        <div className={styles.panelBody}>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void onCreate();
            }}
          >
            <div className={styles.sectionTitle}>Información general</div>

            <div className={styles.grid2}>
              <Field label="Número de solicitud" required>
                <input
                  className={styles.input}
                  value={create.requestNumber}
                  onChange={(e) => setCreate((p) => ({ ...p, requestNumber: e.target.value }))}
                  disabled={createDisabled}
                  placeholder="Ej. ADQ-2026-001"
                />
              </Field>

              <Field label="Fecha de solicitud" required>
                <div className={styles.dateWrap}>
                  <input
                    ref={requestDateRef}
                    className={styles.input}
                    type="date"
                    value={create.requestDate}
                    onChange={(e) => setCreate((p) => ({ ...p, requestDate: e.target.value }))}
                    disabled={createDisabled}
                  />
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => openDatePicker(requestDateRef)}
                    disabled={createDisabled}
                    aria-label="Abrir calendario (fecha de solicitud)"
                    title="Calendario"
                  >
                    <CalendarIcon />
                  </button>
                </div>
              </Field>
            </div>

            <Field label="Justificación" required>
              <textarea
                className={styles.textarea}
                value={create.justification}
                onChange={(e) => setCreate((p) => ({ ...p, justification: e.target.value }))}
                disabled={createDisabled}
                placeholder="Describe por qué se requiere esta adquisición..."
                rows={4}
              />
              <div className={styles.hint}>Tip: incluye objetivo, urgencia y beneficiarios.</div>
            </Field>

            <div className={styles.grid2}>
              <Field label="Fecha de autorización">
                <div className={styles.dateWrap}>
                  <input
                    ref={authDateRef}
                    className={styles.input}
                    type="date"
                    value={create.authorizationDate}
                    onChange={(e) => setCreate((p) => ({ ...p, authorizationDate: e.target.value }))}
                    disabled={createDisabled}
                  />
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => openDatePicker(authDateRef)}
                    disabled={createDisabled}
                    aria-label="Abrir calendario (fecha de autorización)"
                    title="Calendario"
                  >
                    <CalendarIcon />
                  </button>
                </div>
              </Field>

              <Field label="Observaciones">
                <input
                  className={styles.input}
                  value={create.observations}
                  onChange={(e) => setCreate((p) => ({ ...p, observations: e.target.value }))}
                  disabled={createDisabled}
                  placeholder="Notas adicionales (opcional)"
                />
              </Field>
            </div>

            <div className={styles.sectionTitle}>Relaciones</div>

            <div className={styles.grid3}>
              <Field label="Unidad administrativa">
                <select
                  className={styles.select}
                  value={create.idAdministrativeUnit ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idAdministrativeUnit: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {administrativeUnits.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Proyecto">
                <select
                  className={styles.select}
                  value={create.idProject ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idProject: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {projects.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tipo de adquisición">
                <select
                  className={styles.select}
                  value={create.idAcquisitionType ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idAcquisitionType: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {acquisitionTypes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Proveedor">
                <select
                  className={styles.select}
                  value={create.idSupplier ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idSupplier: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {suppliers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Fuente de financiamiento">
                <select
                  className={styles.select}
                  value={create.idFundingSource ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idFundingSource: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {fundingSources.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Clasificación de adquisición">
                <select
                  className={styles.select}
                  value={create.idAcquisitionClassification ?? ""}
                  onChange={(e) =>
                    setCreate((p) => ({ ...p, idAcquisitionClassification: toNullableNumber(e.target.value) }))
                  }
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {acqClassifications.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Programa">
                <select
                  className={styles.select}
                  value={create.idProgram ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idProgram: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {programs.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comunidad">
                <select
                  className={styles.select}
                  value={create.idCommunity ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idCommunity: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {communities.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Beneficiario">
                <select
                  className={styles.select}
                  value={create.idBeneficiary ?? ""}
                  onChange={(e) => setCreate((p) => ({ ...p, idBeneficiary: toNullableNumber(e.target.value) }))}
                  disabled={createDisabled}
                >
                  <option value="">Selecciona...</option>
                  {beneficiaries.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => setCreate(initialCreate)} disabled={createDisabled}>
                Cancelar
              </button>

              <button type="submit" className={styles.btnSave} disabled={createDisabled}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

/** UI */
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

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3M4 8h16M6 21h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 12h3M8 16h3M13 12h3M13 16h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Utils */
function toNullableNumber(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNullableIsoDate(yyyyMmDd: string): string | null {
  const t = String(yyyyMmDd ?? "").trim();
  if (!t) return null;
  return `${t}T00:00:00.000Z`;
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

/** Normalizador genérico */
type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getValue(obj: UnknownRecord, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (k in obj) return obj[k];
  }
  return undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toStringSafe(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function normalizeCatalog(payload: unknown, opts?: NormalizeOpts): CatalogItem[] {
  const defaultIdKeys: readonly string[] = ["id", "Id"];
  const defaultNameKeys: readonly string[] = ["name", "Name", "description", "Description"];

  const idKeys = opts?.idKeys?.length ? opts.idKeys : defaultIdKeys;
  const nameKeys = opts?.nameKeys?.length ? opts.nameKeys : defaultNameKeys;

  let list: unknown[] = [];

  if (Array.isArray(payload)) list = payload;
  else if (isRecord(payload)) {
    const maybeItems = getValue(payload, ["items", "Items", "data", "Data", "result", "Result"]);
    list = asArray(maybeItems);
  }

  return list
    .map((raw): CatalogItem | null => {
      if (!isRecord(raw)) return null;

      const id = toNumber(getValue(raw, idKeys));
      if (!id || id <= 0) return null;

      const name = toStringSafe(getValue(raw, nameKeys)).trim();
      if (!name) return null;

      return { id, name };
    })
    .filter((x): x is CatalogItem => x !== null);
}