import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "../styles/home.module.css";
import { FiSearch } from "react-icons/fi";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type ApiRow = {
  folio?: string | null;
  idRequest?: number;
  IdRequest?: number;
  acquisitionClassification?: string | null;
  AcquisitionClassification?: string | null;
  requestDate?: string | null;
  RequestDate?: string | null;
  status?: string | null;
  Status?: string | null;
  policyNumber?: string | null;
  PolicyNumber?: string | null;
  cfdi?: string | null;
  CFDI?: string | null;
};

type RequestOk = { ok: true; data: unknown; status: number };
type RequestErr = { ok: false; error: string; status: number };
type RequestResult = RequestOk | RequestErr;

type Row = {
  idRequest: number;
  folio: string;
  poliza: string;
  cfdi: string;
  adquisicion: string;
  fecha: string;
  estado: string;
  requestDateRaw?: string | null;
};

type ChecklistItem = {
  documentTypeId: number;
  documentName: string;
  requiredByRule: boolean;
  noApplies: boolean;
  uploaded: boolean;
};

const API_BASE = "/api/AcquisitionRequest";
const EXPEDIENT_API = "/api/expedient-documents";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeText(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function getItemsFromUnknown<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "items" in value) {
    const maybe = (value as { items?: unknown }).items;
    if (Array.isArray(maybe)) return maybe as T[];
  }
  return [];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "1" || t === "si" || t === "sí";
  }
  return false;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toStringSafe(v: unknown) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function normalizeChecklist(payload: unknown): ChecklistItem[] {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? asArray(payload["items"] ?? payload["data"] ?? payload["result"])
      : [];

  return list
    .map((raw): ChecklistItem | null => {
      if (!isRecord(raw)) return null;

      const documentTypeId = toNumber(raw["documentTypeId"] ?? raw["DocumentTypeId"]);
      const documentName = toStringSafe(raw["documentName"] ?? raw["DocumentName"]).trim();

      if (!documentTypeId || !documentName) return null;

      return {
        documentTypeId,
        documentName,
        requiredByRule: toBool(raw["requiredByRule"] ?? raw["RequiredByRule"]),
        noApplies: toBool(raw["noApplies"] ?? raw["NoApplies"]),
        uploaded: toBool(raw["uploaded"] ?? raw["Uploaded"]),
      };
    })
    .filter((x): x is ChecklistItem => x !== null);
}

type StatusFilter = "Todos" | "Completo" | "Incompleto";

function hasValidClassification(label: string) {
  const t = (label ?? "").trim().toLowerCase();
  if (!t) return false;
  if (t === "—") return false;
  if (t === "sin clasificación") return false;
  if (t === "sin clasificacion") return false;
  return true;
}

function computeCompletoFromChecklist(list: ChecklistItem[]) {
  const missingRequired = list.some((x) => x.requiredByRule && !x.noApplies && !x.uploaded);
  return missingRequired ? "Incompleto" : "Completo";
}

function hasPolicy(value: string) {
  const t = (value ?? "").trim().toLowerCase();
  return !!t && t !== "—" && t !== "sin póliza" && t !== "sin poliza";
}

function hasCfdi(value: string) {
  const t = (value ?? "").trim().toLowerCase();
  return !!t && t !== "—" && t !== "sin cfdi";
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const [calcStatus, setCalcStatus] = useState<Record<number, "Completo" | "Incompleto">>({});
  const statusCacheRef = useRef<Map<number, "Completo" | "Incompleto">>(new Map());

  const [toast, setToast] = useState<{ open: boolean; type: ToastType; message: string }>({
    open: false,
    type: "error",
    message: "",
  });

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const url = `${API_BASE}?pageNumber=${pageNumber}&pageSize=${pageSize}`;

      const res = (await requestJson(url, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

      if (!res.ok) {
        setRows([]);
        setHasNext(false);
        setToast({
          open: true,
          type: "error",
          message: res.error || "Error al cargar adquisiciones.",
        });
        return;
      }

      const list = getItemsFromUnknown<ApiRow>(res.data);

      const mapped: Row[] = list
        .map((x) => {
          const idRequest = x.idRequest ?? x.IdRequest ?? 0;
          const folio = x.folio ?? "—";

          const rawPoliza = (x.policyNumber ?? x.PolicyNumber ?? "").trim();
          const poliza = rawPoliza || "Sin póliza";

          const rawCfdi = (x.cfdi ?? x.CFDI ?? "").trim();
          const cfdi = rawCfdi || "Sin CFDI";

          const adquisicion =
            x.acquisitionClassification ?? x.AcquisitionClassification ?? "Sin clasificación";
          const requestDate = x.requestDate ?? x.RequestDate ?? null;
          const estado = x.status ?? x.Status ?? "Sin estatus";

          return {
            idRequest,
            folio,
            poliza,
            cfdi,
            adquisicion,
            fecha: formatDate(requestDate),
            estado,
            requestDateRaw: requestDate,
          };
        })
        .filter((x) => x.idRequest > 0);

      mapped.sort((a, b) => {
        const ta = a.requestDateRaw ? new Date(a.requestDateRaw).getTime() : 0;
        const tb = b.requestDateRaw ? new Date(b.requestDateRaw).getTime() : 0;
        return tb - ta;
      });

      setHasNext(mapped.length === pageSize);
      setRows(mapped);
    } catch {
      setRows([]);
      setHasNext(false);
      setToast({
        open: true,
        type: "error",
        message: "Error inesperado al cargar adquisiciones.",
      });
    } finally {
      setLoading(false);
    }
  }, [pageNumber, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, location.key]);

  useEffect(() => {
    let cancelled = false;

    async function calcForVisibleRows() {
      const toFetch = rows
        .map((r) => r.idRequest)
        .filter((id) => !statusCacheRef.current.has(id));

      if (toFetch.length === 0) return;

      await Promise.all(
        toFetch.map(async (requestId) => {
          try {
            const res = (await requestJson(`${EXPEDIENT_API}/requests/${requestId}/checklist`, {
              method: "GET",
              headers: authHeaders(),
            })) as RequestResult;

            if (!res.ok) return;

            const checklist = normalizeChecklist(res.data);
            const status = computeCompletoFromChecklist(checklist);

            statusCacheRef.current.set(requestId, status);

            if (!cancelled) {
              setCalcStatus((prev) => ({ ...prev, [requestId]: status }));
            }
          } catch {
            // no bloquea la UI si falla
          }
        })
      );
    }

    void calcForVisibleRows();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    let list = rows;

    if (statusFilter !== "Todos") {
      const wanted = normalizeText(statusFilter);
      list = list.filter((r) => {
        const real = calcStatus[r.idRequest] ?? (r.estado as "Completo" | "Incompleto" | string);
        return normalizeText(real) === wanted;
      });
    }

    if (!q) return list;

    return list.filter((r) => {
      const real = calcStatus[r.idRequest] ?? r.estado;

      return (
        normalizeText(r.folio).includes(q) ||
        normalizeText(r.poliza).includes(q) ||
        normalizeText(r.cfdi).includes(q) ||
        normalizeText(r.adquisicion).includes(q) ||
        normalizeText(r.fecha).includes(q) ||
        normalizeText(real).includes(q)
      );
    });
  }, [rows, query, statusFilter, calcStatus]);

  const kpiTotal = filtered.length;
  const kpiCompleto = filtered.filter(
    (r) => normalizeText(calcStatus[r.idRequest] ?? r.estado) === "completo"
  ).length;
  const kpiIncompleto = filtered.filter(
    (r) => normalizeText(calcStatus[r.idRequest] ?? r.estado) === "incompleto"
  ).length;

  function goRegister() {
    navigate("/adquisiciones/registrar");
  }

  function goDetail(idRequest: number, classificationLabel: string) {
    if (!hasValidClassification(classificationLabel)) {
      setToast({
        open: true,
        type: "error",
        message:
          "Esta solicitud no tiene clasificación asignada. No se puede generar el checklist del expediente.",
      });
      return;
    }

    navigate(`/adquisiciones/${idRequest}/expediente`);
  }

  return (
    <div className={styles.page}>
      <Toast open={toast.open} type={toast.type} message={toast.message} onClose={closeToast} />

      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <h1 className={styles.title}>Adquisiciones</h1>
          <p className={styles.subtitle}>Consulta y gestiona solicitudes registradas.</p>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpiChip}>
            <span className={styles.kpiLabel}>Total</span>
            <span className={styles.kpiValue}>{kpiTotal}</span>
          </div>
          <div className={`${styles.kpiChip} ${styles.kpiOk}`}>
            <span className={styles.kpiLabel}>Completo</span>
            <span className={styles.kpiValue}>{kpiCompleto}</span>
          </div>
          <div className={`${styles.kpiChip} ${styles.kpiBad}`}>
            <span className={styles.kpiLabel}>Incompleto</span>
            <span className={styles.kpiValue}>{kpiIncompleto}</span>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <FiSearch className={styles.searchIcon} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por folio, póliza, CFDI, clasificación, estado…"
            aria-label="Buscar adquisición"
          />
        </div>

        <div className={styles.controls}>
          <label className={styles.control}>
            <span>Estado</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="Todos">Todos</option>
              <option value="Completo">Completo</option>
              <option value="Incompleto">Incompleto</option>
            </select>
          </label>

          <label className={styles.control}>
            <span>Tamaño</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageNumber(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <button type="button" className={styles.primaryBtn} onClick={goRegister}>
            Registrar adquisición
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Registros</div>
          <div className={styles.cardNote}>Ordenado por fecha más reciente</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Póliza</th>
                <th>CFDI</th>
                <th>Clasificación</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className={styles.thRight}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Cargando registros...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    No se encontraron registros con esos criterios.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const realEstado = calcStatus[r.idRequest];
                  const shownEstado = realEstado ?? "Calculando…";

                  const st = normalizeText(realEstado ?? "");
                  const badgeClass =
                    st === "completo"
                      ? styles.badgeOk
                      : st === "incompleto"
                        ? styles.badgeBad
                        : styles.badgeNeutral;

                  const policyExists = hasPolicy(r.poliza);
                  const cfdiExists = hasCfdi(r.cfdi);

                  return (
                    <tr key={r.idRequest}>
                      <td className={styles.mono}>{r.folio}</td>

                      <td>
                        {policyExists ? (
                          <span
                            className={`${styles.policyBadge} ${styles.policyBadgeOk}`}
                            title={r.poliza}
                          >
                            {r.poliza}
                          </span>
                        ) : (
                          <span
                            className={`${styles.policyBadge} ${styles.policyBadgeEmpty}`}
                            title="Sin póliza asignada"
                          >
                            Sin póliza
                          </span>
                        )}
                      </td>

                      <td>
                        {cfdiExists ? (
                          <span
                            className={`${styles.policyBadge} ${styles.policyBadgeOk}`}
                            title={r.cfdi}
                          >
                            {r.cfdi}
                          </span>
                        ) : (
                          <span
                            className={`${styles.policyBadge} ${styles.policyBadgeEmpty}`}
                            title="Sin CFDI asignado"
                          >
                            Sin CFDI
                          </span>
                        )}
                      </td>

                      <td className={styles.ellipsis} title={r.adquisicion}>
                        {r.adquisicion}
                      </td>

                      <td className={styles.mono}>{r.fecha}</td>

                      <td>
                        <span className={`${styles.badge} ${badgeClass}`}>{shownEstado}</span>
                      </td>

                      <td className={styles.tdRight}>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => goDetail(r.idRequest, r.adquisicion)}
                          title={`Abrir expediente de solicitud ${r.idRequest}`}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={loading || pageNumber === 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>

          <div className={styles.pageInfo}>
            Página <b>{pageNumber}</b>
          </div>

          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={loading || !hasNext}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}