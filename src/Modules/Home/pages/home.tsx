import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiRefreshCw } from "react-icons/fi";
import styles from "../styles/home.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type ApiRow = {
  folio?: string | null;
  idRequest: number;
  acquisitionClassification?: string | null;
  requestDate?: string | null; // ISO
  status?: string | null;
  policyNumber?: string | null;
};

type RequestOk = { ok: true; data: unknown; status: number };
type RequestErr = { ok: false; error: string; status: number };
type RequestResult = RequestOk | RequestErr;

type Row = {
  idRequest: number;
  folio: string;
  poliza: string;
  adquisicion: string; // etiqueta de clasificación
  area: string;
  fecha: string;
  estado: string;
  requestDateRaw?: string | null;
};

const API_BASE = "/api/AcquisitionRequest";

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

type StatusFilter = "Todos" | "Completo" | "Incompleto";

export default function Home() {
  const navigate = useNavigate();

  // UI
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");

  // Paginación (server-side)
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ open: boolean; type: ToastType; message: string }>({
    open: false,
    type: "error",
    message: "",
  });

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const fetchData = async () => {
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

      const mapped: Row[] = list.map((x) => ({
        idRequest: x.idRequest,
        folio: x.folio ?? "—",
        poliza: x.policyNumber ?? "—",
        adquisicion: x.acquisitionClassification ?? "—",
        area: "—",
        fecha: formatDate(x.requestDate),
        estado: x.status ?? "—",
        requestDateRaw: x.requestDate ?? null,
      }));

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
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    let list = rows;

    if (statusFilter !== "Todos") {
      list = list.filter((r) => normalizeText(r.estado) === normalizeText(statusFilter));
    }

    if (!q) return list;

    return list.filter((r) => {
      return (
        normalizeText(r.folio).includes(q) ||
        normalizeText(r.poliza).includes(q) ||
        normalizeText(r.adquisicion).includes(q) ||
        normalizeText(r.area).includes(q) ||
        normalizeText(r.fecha).includes(q) ||
        normalizeText(r.estado).includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  const kpiTotal = filtered.length;
  const kpiCompleto = filtered.filter((r) => normalizeText(r.estado) === "completo").length;
  const kpiIncompleto = filtered.filter((r) => normalizeText(r.estado) === "incompleto").length;

  function goRegister() {
    navigate("/adquisiciones/registrar");
  }

  // ✅ Ahora “Ver detalle” abre el Expediente (checklist/carga masiva)
  function goDetail(idRequest: number, classificationLabel: string) {
    // (Opcional) Si no hay clasificación, avisa porque checklist depende de eso
    if (!classificationLabel || classificationLabel.trim() === "—") {
      setToast({
        open: true,
        type: "error",
        message: "Esta solicitud no tiene clasificación asignada. No se puede generar el checklist del expediente.",
      });
      return;
    }

    navigate(`/adquisiciones/${idRequest}/expediente`);
  }

  return (
    <div className={styles.page}>
      <Toast open={toast.open} type={toast.type} message={toast.message} onClose={closeToast} />

      {/* Topbar */}
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

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <FiSearch className={styles.searchIcon} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por folio, póliza, clasificación, estado…"
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

          <button type="button" className={styles.ghostBtn} onClick={() => void fetchData()} disabled={loading} title="Recargar">
            <FiRefreshCw />
            {loading ? "Cargando..." : "Recargar"}
          </button>

          <button type="button" className={styles.primaryBtn} onClick={goRegister}>
            Registrar adquisición
          </button>
        </div>
      </div>

      {/* Table */}
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
                <th>Clasificación</th>
                <th>Área</th>
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
                  const st = normalizeText(r.estado);
                  const badgeClass =
                    st === "completo"
                      ? styles.badgeOk
                      : st === "incompleto"
                        ? styles.badgeBad
                        : styles.badgeNeutral;

                  return (
                    <tr key={r.idRequest}>
                      <td className={styles.mono}>{r.folio}</td>
                      <td className={styles.mono}>{r.poliza}</td>
                      <td className={styles.ellipsis} title={r.adquisicion}>
                        {r.adquisicion}
                      </td>
                      <td className={styles.ellipsis}>{r.area}</td>
                      <td className={styles.mono}>{r.fecha}</td>
                      <td>
                        <span className={`${styles.badge} ${badgeClass}`}>{r.estado}</span>
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

        {/* Pagination */}
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