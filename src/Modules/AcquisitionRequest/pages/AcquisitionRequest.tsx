import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AcquisitionRequest.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";
import AcquisitionRequestPostCreate from "../components/AcquisitionRequestPostCreate";

type CatalogItem = { id: number; name: string };

type CreateDetail = {
  idCog: number | null;
  quantity: string;
  unitMeasure: string;
  description: string;
  unitAmount: string;
};

type CreateForm = {
  requestNumber: string;
  requestDate: string;
  justification: string;
  authorizationDate: string;
  completeMaximeDate: string;
  observations: string;
  cfdi: string;

  idAdministrativeUnit: number | null;
  idProject: number | null;
  idAcquisitionType: number | null;
  idSupplier: number | null;

  idFundingSource: number | null;
  idAcquisitionClassification: number | null;
  idProgram: number | null;
  idCommunity: number | null;
  idBeneficiary: number | null;

  details: CreateDetail[];
};

type Step = "create" | "postCreate";

const API_BASE = "/api/AcquisitionRequest";

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
  cogs: "/api/Cog",
} as const;

const emptyDetail = (): CreateDetail => ({
  idCog: null,
  quantity: "",
  unitMeasure: "",
  description: "",
  unitAmount: "",
});

const initialCreate: CreateForm = {
  requestNumber: "",
  requestDate: "",
  justification: "",
  authorizationDate: "",
  completeMaximeDate: "",
  observations: "",
  cfdi: "",

  idAdministrativeUnit: null,
  idProject: null,
  idAcquisitionType: null,
  idSupplier: null,

  idFundingSource: null,
  idAcquisitionClassification: null,
  idProgram: null,
  idCommunity: null,
  idBeneficiary: null,

  details: [emptyDetail()],
};

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getValue(obj: UnknownRecord, keys: readonly string[]): unknown {
  for (const k of keys) if (k in obj) return obj[k];
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

type NormalizeOpts = {
  idKeys?: readonly string[];
  nameKeys?: readonly string[];
};

function normalizeCatalog(
  payload: unknown,
  opts?: NormalizeOpts,
): CatalogItem[] {
  const defaultIdKeys: readonly string[] = ["id", "Id"];
  const defaultNameKeys: readonly string[] = [
    "name",
    "Name",
    "description",
    "Description",
  ];

  const idKeys = opts?.idKeys?.length ? opts.idKeys : defaultIdKeys;
  const nameKeys = opts?.nameKeys?.length ? opts.nameKeys : defaultNameKeys;

  let list: unknown[] = [];

  if (Array.isArray(payload)) list = payload;
  else if (isRecord(payload)) {
    const maybeItems = getValue(payload, [
      "items",
      "Items",
      "data",
      "Data",
      "result",
      "Result",
    ]);
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

function toNullableNumber(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toPositiveNumber(s: string): number | null {
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

function extractIdRequest(payload: unknown): number | null {
  if (typeof payload === "number") return payload;

  if (isRecord(payload)) {
    const v = getValue(payload, ["idRequest", "IdRequest", "id", "Id"]);
    const n = toNumber(v);
    return n && n > 0 ? n : null;
  }
  return null;
}

function hasCreateChanges(form: CreateForm): boolean {
  return (
    form.requestNumber.trim() !== "" ||
    form.requestDate.trim() !== "" ||
    form.justification.trim() !== "" ||
    form.authorizationDate.trim() !== "" ||
    form.completeMaximeDate.trim() !== "" ||
    form.observations.trim() !== "" ||
    form.cfdi.trim() !== "" ||
    form.idAdministrativeUnit !== null ||
    form.idProject !== null ||
    form.idAcquisitionType !== null ||
    form.idSupplier !== null ||
    form.idFundingSource !== null ||
    form.idAcquisitionClassification !== null ||
    form.idProgram !== null ||
    form.idCommunity !== null ||
    form.idBeneficiary !== null ||
    form.details.some(
      (d) =>
        d.idCog !== null ||
        d.quantity.trim() !== "" ||
        d.unitMeasure.trim() !== "" ||
        d.description.trim() !== "" ||
        d.unitAmount.trim() !== "",
    )
  );
}

export default function AcquisitionRequest() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<Step>("create");
  const [createdIdRequest, setCreatedIdRequest] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [create, setCreate] = useState<CreateForm>(initialCreate);

  const [loadingCats, setLoadingCats] = useState(false);

  const [administrativeUnits, setAdministrativeUnits] = useState<CatalogItem[]>(
    [],
  );
  const [projects, setProjects] = useState<CatalogItem[]>([]);
  const [acquisitionTypes, setAcquisitionTypes] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogItem[]>([]);
  const [fundingSources, setFundingSources] = useState<CatalogItem[]>([]);
  const [acqClassifications, setAcqClassifications] = useState<CatalogItem[]>(
    [],
  );
  const [programs, setPrograms] = useState<CatalogItem[]>([]);
  const [communities, setCommunities] = useState<CatalogItem[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<CatalogItem[]>([]);
  const [cogs, setCogs] = useState<CatalogItem[]>([]);

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
  const maxDateRef = useRef<HTMLInputElement | null>(null);
  const lastOutsideToastRef = useRef(0);

  const createDisabled = saving || loadingCats;
  const isCreateDirty = useMemo(() => hasCreateChanges(create), [create]);

  const workflowLocked = useMemo(() => {
    if (saving || loadingCats) return true;
    if (step === "create" && isCreateDirty) return true;
    return false;
  }, [saving, loadingCats, step, isCreateDirty]);

  const resetAll = useCallback(() => {
    setStep("create");
    setCreatedIdRequest(null);
    setCreate(initialCreate);
  }, []);

  useEffect(() => {
    if (!workflowLocked) return;

    const showOutsideClickToast = () => {
      const now = Date.now();
      if (now - lastOutsideToastRef.current < 1200) return;
      lastOutsideToastRef.current = now;
      showToast(
        "error",
        "Debes terminar o cancelar el registro actual antes de salir.",
      );
    };

    const blockOutsideInteraction = (event: Event) => {
      const root = pageRef.current;
      const target = event.target as Node | null;

      if (!root || !target) return;
      if (root.contains(target)) return;

      event.preventDefault();
      event.stopPropagation();

      if (
        "stopImmediatePropagation" in event &&
        typeof event.stopImmediatePropagation === "function"
      ) {
        event.stopImmediatePropagation();
      }

      showOutsideClickToast();
    };

    document.addEventListener("pointerdown", blockOutsideInteraction, true);
    document.addEventListener("click", blockOutsideInteraction, true);
    document.addEventListener("touchstart", blockOutsideInteraction, true);

    return () => {
      document.removeEventListener(
        "pointerdown",
        blockOutsideInteraction,
        true,
      );
      document.removeEventListener("click", blockOutsideInteraction, true);
      document.removeEventListener("touchstart", blockOutsideInteraction, true);
    };
  }, [workflowLocked, showToast]);

  useEffect(() => {
    if (!workflowLocked) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [workflowLocked]);

  const loadCatalogGeneric = useCallback(
    async (
      url: string,
      label: string,
      opts?: NormalizeOpts,
    ): Promise<CatalogItem[]> => {
      const result = await requestJson(url, {
        method: "GET",
        headers: authHeaders(),
      });
      if (!result.ok) throw new Error(`${label}: ${result.error}`);
      return normalizeCatalog(result.data, opts);
    },
    [],
  );

  const loadProjects = useCallback(async (): Promise<CatalogItem[]> => {
    const result = await requestJson(CATALOG_ENDPOINTS.projects, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!result.ok) throw new Error(`Proyectos: ${result.error}`);

    return normalizeCatalog(result.data, {
      idKeys: ["idProyect", "IdProyect", "id", "Id"],
      nameKeys: ["description", "Description", "name", "Name"],
    });
  }, []);

  const loadBeneficiaries = useCallback(async (): Promise<CatalogItem[]> => {
    const result = await requestJson(CATALOG_ENDPOINTS.beneficiaries, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!result.ok) throw new Error(`Beneficiarios: ${result.error}`);

    const payload = result.data;
    const list: unknown[] = Array.isArray(payload)
      ? payload
      : isRecord(payload)
        ? asArray(
            getValue(payload, [
              "items",
              "Items",
              "data",
              "Data",
              "result",
              "Result",
            ]),
          )
        : [];

    return list
      .map((raw): CatalogItem | null => {
        if (!isRecord(raw)) return null;

        const id = toNumber(
          getValue(raw, ["idBeneficiary", "IdBeneficiary", "id", "Id"]),
        );
        if (!id || id <= 0) return null;

        const firstName = toStringSafe(
          getValue(raw, ["firstName", "FirstName"]),
        ).trim();
        const paternal = toStringSafe(
          getValue(raw, ["paternalLastName", "PaternalLastName"]),
        ).trim();
        const maternal = toStringSafe(
          getValue(raw, ["maternalLastName", "MaternalLastName"]),
        ).trim();
        const community = toStringSafe(
          getValue(raw, ["communityName", "CommunityName"]),
        ).trim();

        const full = [firstName, paternal, maternal]
          .filter(Boolean)
          .join(" ")
          .trim();
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
          run: () =>
            loadCatalogGeneric(
              CATALOG_ENDPOINTS.administrativeUnits,
              "Unidades administrativas",
              {
                idKeys: [
                  "idAdministrativeUnit",
                  "IdAdministrativeUnit",
                  "id",
                  "Id",
                ],
                nameKeys: ["description", "Description", "name", "Name"],
              },
            ),
        },
        { key: "projects", run: () => loadProjects() },
        {
          key: "acquisitionTypes",
          run: () =>
            loadCatalogGeneric(
              CATALOG_ENDPOINTS.acquisitionTypes,
              "Tipos de adquisición",
              {
                idKeys: ["idAcquisitionType", "IdAcquisitionType", "id", "Id"],
                nameKeys: [
                  "description",
                  "Description",
                  "name",
                  "Name",
                  "typeName",
                  "TypeName",
                ],
              },
            ),
        },
        {
          key: "suppliers",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.suppliers, "Proveedores", {
              idKeys: ["idSupplier", "IdSupplier", "id", "Id"],
              nameKeys: [
                "supplierName",
                "SupplierName",
                "businessName",
                "BusinessName",
                "name",
                "Name",
                "description",
              ],
            }),
        },
        {
          key: "fundingSources",
          run: () =>
            loadCatalogGeneric(
              CATALOG_ENDPOINTS.fundingSources,
              "Fuentes de financiamiento",
              {
                idKeys: ["idFundingSource", "IdFundingSource", "id", "Id"],
                nameKeys: [
                  "description",
                  "Description",
                  "name",
                  "Name",
                  "sourceName",
                  "SourceName",
                ],
              },
            ),
        },
        {
          key: "acqClassifications",
          run: () =>
            loadCatalogGeneric(
              CATALOG_ENDPOINTS.acquisitionClassifications,
              "Clasificación de adquisición",
              {
                idKeys: [
                  "idAcquisitionClassification",
                  "IdAcquisitionClassification",
                  "id",
                  "Id",
                ],
                nameKeys: [
                  "description",
                  "Description",
                  "classificationName",
                  "ClassificationName",
                  "name",
                  "Name",
                ],
              },
            ),
        },
        {
          key: "programs",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.programs, "Programas", {
              idKeys: [
                "idProgram",
                "IdProgram",
                "id",
                "Id",
                "idProg",
                "IdProg",
              ],
              nameKeys: [
                "description",
                "Description",
                "programName",
                "ProgramName",
                "name",
                "Name",
              ],
            }),
        },
        {
          key: "communities",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.communities, "Comunidades", {
              idKeys: ["idCommunity", "IdCommunity", "id", "Id"],
              nameKeys: [
                "communityName",
                "CommunityName",
                "description",
                "Description",
                "name",
                "Name",
              ],
            }),
        },
        { key: "beneficiaries", run: () => loadBeneficiaries() },
        {
          key: "cogs",
          run: () =>
            loadCatalogGeneric(CATALOG_ENDPOINTS.cogs, "COG", {
              idKeys: ["idCog", "IdCog", "id", "Id"],
              nameKeys: ["description", "Description", "name", "Name"],
            }),
        },
      ] as const;

      const results = await Promise.allSettled(tasks.map((t) => t.run()));
      if (!alive) return;

      results.forEach((r, i) => {
        const t = tasks[i];
        if (r.status !== "fulfilled") {
          showToast(
            "error",
            r.reason instanceof Error ? r.reason.message : String(r.reason),
          );
          return;
        }

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
          case "cogs":
            setCogs(list);
            break;
        }
      });

      setLoadingCats(false);
    }

    void run();
    return () => {
      alive = false;
    };
  }, [loadCatalogGeneric, loadProjects, loadBeneficiaries, showToast]);

  function updateDetail(index: number, patch: Partial<CreateDetail>) {
    setCreate((prev) => ({
      ...prev,
      details: prev.details.map((d, i) =>
        i === index ? { ...d, ...patch } : d,
      ),
    }));
  }

  function addDetail() {
    setCreate((prev) => ({
      ...prev,
      details: [...prev.details, emptyDetail()],
    }));
  }

  function removeDetail(index: number) {
    setCreate((prev) => {
      if (prev.details.length === 1) {
        return { ...prev, details: [emptyDetail()] };
      }
      return {
        ...prev,
        details: prev.details.filter((_, i) => i !== index),
      };
    });
  }

  function validateCreate(): string {
    const req = create.requestNumber.trim();
    const date = create.requestDate.trim();
    const just = create.justification.trim();

    if (!req) return "El número de solicitud es obligatorio.";
    if (req.length < 2) return "El número de solicitud es demasiado corto.";
    if (!date) return "La fecha de solicitud es obligatoria.";
    if (!just) return "La justificación es obligatoria.";
    if (just.length < 5) return "La justificación es demasiado corta.";
    if (!create.idAcquisitionClassification)
      return "Selecciona la clasificación de adquisición.";

    if (!create.details.length) return "Debes agregar al menos un detalle.";

    for (let i = 0; i < create.details.length; i++) {
      const d = create.details[i];
      const row = i + 1;

      if (!d.idCog) return `Selecciona el COG del detalle ${row}.`;

      const quantity = toPositiveNumber(d.quantity);
      if (!quantity)
        return `La cantidad del detalle ${row} debe ser mayor a 0.`;

      if (!d.unitMeasure.trim())
        return `La unidad de medida del detalle ${row} es obligatoria.`;

      if (!d.description.trim())
        return `La descripción del detalle ${row} es obligatoria.`;

      const unitAmount = toPositiveNumber(d.unitAmount);
      if (!unitAmount)
        return `El importe unitario del detalle ${row} debe ser mayor a 0.`;
    }

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
        completeMaximeDate: toNullableIsoDate(create.completeMaximeDate),
        observations: create.observations.trim() || null,
        cfdi: create.cfdi.trim() || null,

        idAdministrativeUnit: create.idAdministrativeUnit,
        idProject: create.idProject,
        idAcquisitionType: create.idAcquisitionType,
        idSupplier: create.idSupplier,

        idApplicationStatus: null,
        idFundingSource: create.idFundingSource,
        idAcquisitionClassification: create.idAcquisitionClassification,
        idProgram: create.idProgram,
        idCommunity: create.idCommunity,
        idBeneficiary: create.idBeneficiary,
        idPayementPolicy: null,

        details: create.details.map((d) => ({
          idCog: d.idCog!,
          quantity: Number(d.quantity),
          unitMeasure: d.unitMeasure.trim(),
          description: d.description.trim(),
          unitAmount: Number(d.unitAmount),
        })),
      };

      const result = await requestJson(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      const idRequest = extractIdRequest(result.data);
      if (!idRequest) {
        showToast(
          "error",
          "Se registró la solicitud, pero no se pudo leer el idRequest del servidor.",
        );
        return;
      }

      setCreatedIdRequest(idRequest);
      setStep("postCreate");
      showToast("success", `Solicitud registrada. Folio interno: ${idRequest}`);
    } catch (error: unknown) {
      showToast("error", toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

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

  const headerHint = useMemo(() => {
    if (loadingCats) return "Cargando catálogos y preparando el formulario.";
    if (step === "postCreate")
      return "Completa el responsable y define qué documentos no aplican para esta solicitud.";
    return "Captura la información general, relaciones y al menos un detalle para registrar la solicitud.";
  }, [loadingCats, step]);

  const titleRight = useMemo(() => {
    if (step === "postCreate" && createdIdRequest)
      return `ID Solicitud: ${createdIdRequest}`;
    return "Alta de solicitud";
  }, [step, createdIdRequest]);

  return (
    <div
      ref={pageRef}
      className={`${styles.page} ${workflowLocked ? styles.pageLocked : ""}`}
    >
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
            <h1 className={styles.h1}>Registro de adquisición</h1>
            <p className={styles.sub}>{headerHint}</p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnBack}
              type="button"
              onClick={() => navigate("/home")}
              disabled={workflowLocked || saving}
              title="Regresar al home"
            >
              Volver al inicio
            </button>

            <button
              className={styles.btnGhost}
              type="button"
              onClick={resetAll}
              disabled={createDisabled}
              title="Borrar captura"
            >
              Borrar datos
            </button>
          </div>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>
            {step === "create" ? "Nueva solicitud" : "Post-registro"}
          </p>
          <span className={styles.badge}>{titleRight}</span>
        </div>

        <div className={styles.panelBody}>
          {step === "create" && (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void onCreate();
              }}
            >
              <div className={styles.detailCard}>
                <div className={styles.sectionTitle}>Información general</div>

                <div className={styles.doubleRow}>
                  <FloatingField label="Número de solicitud" required>
                    <input
                      className={styles.floatingInput}
                      value={create.requestNumber}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          requestNumber: event.target.value,
                        }))
                      }
                      disabled={createDisabled}
                      placeholder="Ej. ADQ-2026-001"
                    />
                  </FloatingField>

                  <FloatingField label="Fecha de solicitud" required>
                    <div className={styles.dateWrap}>
                      <input
                        ref={requestDateRef}
                        className={`${styles.floatingInput} ${styles.dateInput}`}
                        type="date"
                        value={create.requestDate}
                        onChange={(event) =>
                          setCreate((p) => ({
                            ...p,
                            requestDate: event.target.value,
                          }))
                        }
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
                  </FloatingField>
                </div>

                <FloatingFieldArea label="Justificación" required>
                  <textarea
                    className={styles.floatingTextareaArea}
                    value={create.justification}
                    onChange={(event) =>
                      setCreate((p) => ({
                        ...p,
                        justification: event.target.value,
                      }))
                    }
                    disabled={createDisabled}
                    placeholder="Describe por qué se requiere esta adquisición..."
                    rows={4}
                  />
                </FloatingFieldArea>

                <div className={styles.hint}>
                  Tip: incluye objetivo, urgencia y beneficiarios.
                </div>

                <div className={styles.doubleRow}>
                  <FloatingField label="Fecha de autorización">
                    <div className={styles.dateWrap}>
                      <input
                        ref={authDateRef}
                        className={`${styles.floatingInput} ${styles.dateInput}`}
                        type="date"
                        value={create.authorizationDate}
                        onChange={(event) =>
                          setCreate((p) => ({
                            ...p,
                            authorizationDate: event.target.value,
                          }))
                        }
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
                  </FloatingField>

                  <FloatingField label="Fecha límite">
                    <div className={styles.dateWrap}>
                      <input
                        ref={maxDateRef}
                        className={`${styles.floatingInput} ${styles.dateInput}`}
                        type="date"
                        value={create.completeMaximeDate}
                        onChange={(event) =>
                          setCreate((p) => ({
                            ...p,
                            completeMaximeDate: event.target.value,
                          }))
                        }
                        disabled={createDisabled}
                      />
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openDatePicker(maxDateRef)}
                        disabled={createDisabled}
                        aria-label="Abrir calendario (fecha límite)"
                        title="Calendario"
                      >
                        <CalendarIcon />
                      </button>
                    </div>
                  </FloatingField>
                </div>

                <FloatingField label="CFDI">
                  <input
                    className={styles.floatingInput}
                    value={create.cfdi}
                    onChange={(event) =>
                      setCreate((p) => ({ ...p, cfdi: event.target.value }))
                    }
                    disabled={createDisabled}
                    placeholder="Ej. UUID, folio o referencia CFDI"
                  />
                </FloatingField>

                <FloatingField label="Observaciones">
                  <input
                    className={styles.floatingInput}
                    value={create.observations}
                    onChange={(event) =>
                      setCreate((p) => ({
                        ...p,
                        observations: event.target.value,
                      }))
                    }
                    disabled={createDisabled}
                    placeholder="Notas adicionales (opcional)"
                  />
                </FloatingField>

                <div className={styles.sectionTitle}>Relaciones</div>

                <div className={styles.grid3}>
                  <FloatingField label="Unidad administrativa">
                    <select
                      className={styles.floatingSelect}
                      value={create.idAdministrativeUnit ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idAdministrativeUnit: toNullableNumber(
                            event.target.value,
                          ),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {administrativeUnits.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Proyecto">
                    <select
                      className={styles.floatingSelect}
                      value={create.idProject ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idProject: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {projects.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Tipo de adquisición">
                    <select
                      className={styles.floatingSelect}
                      value={create.idAcquisitionType ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idAcquisitionType: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {acquisitionTypes.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Proveedor">
                    <select
                      className={styles.floatingSelect}
                      value={create.idSupplier ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idSupplier: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {suppliers.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Fuente de financiamiento">
                    <select
                      className={styles.floatingSelect}
                      value={create.idFundingSource ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idFundingSource: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {fundingSources.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Clasificación de adquisición" required>
                    <select
                      className={styles.floatingSelect}
                      value={create.idAcquisitionClassification ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idAcquisitionClassification: toNullableNumber(
                            event.target.value,
                          ),
                        }))
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
                  </FloatingField>

                  <FloatingField label="Programa">
                    <select
                      className={styles.floatingSelect}
                      value={create.idProgram ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idProgram: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {programs.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Comunidad">
                    <select
                      className={styles.floatingSelect}
                      value={create.idCommunity ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idCommunity: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {communities.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  <FloatingField label="Beneficiario">
                    <select
                      className={styles.floatingSelect}
                      value={create.idBeneficiary ?? ""}
                      onChange={(event) =>
                        setCreate((p) => ({
                          ...p,
                          idBeneficiary: toNullableNumber(event.target.value),
                        }))
                      }
                      disabled={createDisabled}
                    >
                      <option value="">Selecciona...</option>
                      {beneficiaries.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </FloatingField>
                </div>

                <div className={styles.sectionTitle}>
                  Detalles de la solicitud
                </div>

                <div className={styles.docsHint}>
                  Debes capturar al menos un detalle para poder guardar la
                  solicitud.
                </div>

                <div className={styles.docsWrap}>
                  {create.details.map((detail, index) => (
                    <div key={index} className={styles.docRow}>
                      <div className={styles.docLeft}>
                        <div className={styles.sectionTitle}>
                          Detalle {index + 1}
                        </div>

                        <div className={styles.grid3}>
                          <FloatingField label="COG" required>
                            <select
                              className={styles.floatingSelect}
                              value={detail.idCog ?? ""}
                              onChange={(event) =>
                                updateDetail(index, {
                                  idCog: toNullableNumber(event.target.value),
                                })
                              }
                              disabled={createDisabled}
                            >
                              <option value="">Selecciona...</option>
                              {cogs.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                            </select>
                          </FloatingField>

                          <FloatingField label="Cantidad" required>
                            <input
                              className={styles.floatingInput}
                              value={detail.quantity}
                              onChange={(event) =>
                                updateDetail(index, {
                                  quantity: event.target.value,
                                })
                              }
                              disabled={createDisabled}
                              placeholder="Ej. 2"
                              inputMode="numeric"
                            />
                          </FloatingField>

                          <FloatingField label="Unidad de medida" required>
                            <input
                              className={styles.floatingInput}
                              value={detail.unitMeasure}
                              onChange={(event) =>
                                updateDetail(index, {
                                  unitMeasure: event.target.value,
                                })
                              }
                              disabled={createDisabled}
                              placeholder="Ej. Pieza"
                            />
                          </FloatingField>
                        </div>

                        <div className={styles.doubleRow}>
                          <FloatingField label="Descripción" required>
                            <input
                              className={styles.floatingInput}
                              value={detail.description}
                              onChange={(event) =>
                                updateDetail(index, {
                                  description: event.target.value,
                                })
                              }
                              disabled={createDisabled}
                              placeholder="Describe el concepto"
                            />
                          </FloatingField>

                          <FloatingField label="Importe unitario" required>
                            <input
                              className={styles.floatingInput}
                              value={detail.unitAmount}
                              onChange={(event) =>
                                updateDetail(index, {
                                  unitAmount: event.target.value,
                                })
                              }
                              disabled={createDisabled}
                              placeholder="Ej. 1500"
                              inputMode="decimal"
                            />
                          </FloatingField>
                        </div>

                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => removeDetail(index)}
                            disabled={createDisabled}
                          >
                            Quitar detalle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={addDetail}
                    disabled={createDisabled}
                  >
                    Agregar detalle
                  </button>

                  <button
                    type="submit"
                    className={styles.btnSave}
                    disabled={createDisabled}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === "postCreate" && createdIdRequest && (
            <AcquisitionRequestPostCreate
              idRequest={createdIdRequest}
              classificationId={create.idAcquisitionClassification}
              administrativeUnits={administrativeUnits}
              initialAdministrativeUnitId={create.idAdministrativeUnit}
              showToast={showToast}
              onSuccess={() => {
                resetAll();
                navigate("/home");
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function FloatingField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.floatingField}>
      <span className={styles.floatingLabel}>
        {label} {required && <span className={styles.required}>*</span>}
      </span>
      {children}
    </div>
  );
}

function FloatingFieldArea({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.floatingFieldArea}>
      <span className={styles.floatingLabel}>
        {label} {required && <span className={styles.required}>*</span>}
      </span>
      {children}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2v3M16 2v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 9h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 13h3M8 17h3M14 13h2.5M14 17h2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}