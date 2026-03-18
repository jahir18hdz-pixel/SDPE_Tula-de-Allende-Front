import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "../styles/home.module.css";
import { FiSearch, FiTrash2 } from "react-icons/fi";
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

type PaymentPolicyPreviewRow = {
  idPaymentPolicy?: number;
  IdPaymentPolicy?: number;
  policyCode?: string | null;
  PolicyCode?: string | null;
  description?: string | null;
  Description?: string | null;
  previewUrl?: string | null;
  PreviewUrl?: string | null;
};

type PreviewItem = {
  url: string;
  name: string;
  type: "pdf" | "image" | "other";
};

const API_BASE = "/api/AcquisitionRequest";
const PAYMENT_POLICY_API = "/api/PaymentPolicy";

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
  return String(v ?? "")
    .trim()
    .toLowerCase();
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

function hasValidClassification(label: string) {
  const t = (label ?? "").trim().toLowerCase();
  if (!t) return false;
  if (t === "—") return false;
  if (t === "sin clasificación") return false;
  if (t === "sin clasificacion") return false;
  return true;
}

function hasPolicy(value: string) {
  const t = (value ?? "").trim().toLowerCase();
  return !!t && t !== "—" && t !== "sin póliza" && t !== "sin poliza";
}

function hasCfdi(value: string) {
  const t = (value ?? "").trim().toLowerCase();
  return !!t && t !== "—" && t !== "sin cfdi";
}

function getExtensionFromSource(source: string) {
  const clean = source.split("?")[0].split("#")[0].trim().toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

function getPreviewType(
  url: string,
  fileName?: string | null,
): "image" | "pdf" | "other" {
  const combined = `${fileName ?? ""} ${url}`.toLowerCase();
  const ext = getExtensionFromSource(combined);

  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"];

  if (imageExts.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";

  if (
    combined.includes(".jpg") ||
    combined.includes(".jpeg") ||
    combined.includes(".png") ||
    combined.includes(".gif") ||
    combined.includes(".webp") ||
    combined.includes(".bmp") ||
    combined.includes(".svg") ||
    combined.includes(".avif")
  ) {
    return "image";
  }

  if (combined.includes(".pdf")) return "pdf";

  return "other";
}

function normalizeUrlMaybe(u: string) {
  return (u ?? "").trim();
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

  const [toast, setToast] = useState<{
    open: boolean;
    type: ToastType;
    message: string;
  }>({
    open: false,
    type: "error",
    message: "",
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

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
            x.acquisitionClassification ??
            x.AcquisitionClassification ??
            "Sin clasificación";

          const requestDate = x.requestDate ?? x.RequestDate ?? null;

          // Fuente única de verdad: estado del backend
          const estado = (x.status ?? x.Status ?? "").trim() || "Sin estatus";

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

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewItem(null);
  }, []);

  const openUrl = useCallback((u: string) => {
    const url = normalizeUrlMaybe(u);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openPolicyPreview = useCallback(async (policyCode: string) => {
    const code = policyCode.trim();

    if (
      !code ||
      code.toLowerCase() === "sin póliza" ||
      code.toLowerCase() === "sin poliza"
    ) {
      setToast({
        open: true,
        type: "error",
        message: "Esta adquisición no tiene póliza asignada.",
      });
      return;
    }

    setLoadingPreview(true);

    try {
      const res = (await requestJson(
        `${PAYMENT_POLICY_API}/policies?page=1&pageSize=200`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      )) as RequestResult;

      if (!res.ok) {
        setToast({
          open: true,
          type: "error",
          message: res.error || "No se pudieron consultar las pólizas.",
        });
        return;
      }

      const list = getItemsFromUnknown<PaymentPolicyPreviewRow>(res.data);

      const found =
        list.find((x) => {
          const currentCode = (x.policyCode ?? x.PolicyCode ?? "")
            .trim()
            .toLowerCase();
          return currentCode === code.toLowerCase();
        }) ?? null;

      if (!found) {
        setToast({
          open: true,
          type: "error",
          message: `No se encontró la póliza ${code}.`,
        });
        return;
      }

      const previewUrl = normalizeUrlMaybe(
        found.previewUrl ?? found.PreviewUrl ?? "",
      );
      if (!previewUrl) {
        setToast({
          open: true,
          type: "error",
          message: "La póliza no tiene PreviewUrl disponible.",
        });
        return;
      }

      const fileName = `${code}`;
      setPreviewItem({
        url: previewUrl,
        name: fileName,
        type: getPreviewType(previewUrl, fileName),
      });
      setPreviewOpen(true);
    } catch {
      setToast({
        open: true,
        type: "error",
        message: "Error inesperado al abrir la póliza.",
      });
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const openDeleteModal = useCallback((row: Row) => {
    setDeleteTarget(row);
    setDeletePassword("");
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeletePassword("");
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    const password = deletePassword.trim();
    if (!password) {
      setToast({
        open: true,
        type: "error",
        message: "Ingresa la contraseña para confirmar la eliminación.",
      });
      return;
    }

    setDeleting(true);

    try {
      const res = (await requestJson(`${API_BASE}/${deleteTarget.idRequest}`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({
          password,
        }),
      })) as RequestResult;

      if (!res.ok) {
        setToast({
          open: true,
          type: "error",
          message: res.error || "No se pudo eliminar la adquisición.",
        });
        return;
      }

      setToast({
        open: true,
        type: "success",
        message: `La adquisición ${deleteTarget.folio} se eliminó correctamente.`,
      });

      closeDeleteModal();
      await fetchData();
    } catch {
      setToast({
        open: true,
        type: "error",
        message: "Error inesperado al eliminar la adquisición.",
      });
    } finally {
      setDeleting(false);
    }
  }, [deletePassword, deleteTarget, closeDeleteModal, fetchData]);

  useEffect(() => {
    if (!previewOpen && !deleteModalOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteModalOpen) {
          closeDeleteModal();
          return;
        }

        if (previewOpen) {
          closePreview();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen, deleteModalOpen, closePreview, closeDeleteModal]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    let list = [...rows];

    // 1) Filtro usa solo r.estado
    if (statusFilter !== "Todos") {
      const wanted = normalizeText(statusFilter);
      list = list.filter((r) => normalizeText(r.estado) === wanted);
    }

    // 2) Búsqueda usa solo r.estado
    if (q) {
      list = list.filter((r) => {
        const real = r.estado;

        return (
          normalizeText(r.folio).includes(q) ||
          normalizeText(r.poliza).includes(q) ||
          normalizeText(r.cfdi).includes(q) ||
          normalizeText(r.adquisicion).includes(q) ||
          normalizeText(r.fecha).includes(q) ||
          normalizeText(real).includes(q)
        );
      });
    }

    // 3) Orden usa solo r.estado
    list.sort((a, b) => {
      const statusA = normalizeText(a.estado);
      const statusB = normalizeText(b.estado);

      const aIsComplete = statusA === "completo";
      const bIsComplete = statusB === "completo";

      // Incompleto primero, Completo después (como tu segunda vista)
      if (aIsComplete !== bIsComplete) {
        return aIsComplete ? 1 : -1;
      }

      const dateA = a.requestDateRaw ? new Date(a.requestDateRaw).getTime() : 0;
      const dateB = b.requestDateRaw ? new Date(b.requestDateRaw).getTime() : 0;

      return dateB - dateA;
    });

    return list;
  }, [rows, query, statusFilter]);

  // 4) KPIs usan solo r.estado
  const kpiTotal = filtered.length;
  const kpiCompleto = filtered.filter(
    (r) => normalizeText(r.estado) === "completo",
  ).length;
  const kpiIncompleto = filtered.filter(
    (r) => normalizeText(r.estado) === "incompleto",
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

  const isAnyModalOpen = previewOpen || deleteModalOpen;

  return (
    <div
      className={`${styles.page} ${isAnyModalOpen ? styles.pageLocked : ""}`}
    >
      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={closeToast}
      />

      <div
        className={`${styles.mainContent} ${
          isAnyModalOpen ? styles.mainContentBlurred : ""
        }`}
      >
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <h1 className={styles.title}>Adquisiciones</h1>
            <p className={styles.subtitle}>
              Consulta y gestiona solicitudes registradas.
            </p>
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
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
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

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={goRegister}
            >
              Registrar adquisición
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Registros</div>
            <div className={styles.cardNote}>
              Ordenado por fecha más reciente
            </div>
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
                    // Columna Estado: r.estado o "Sin estatus"
                    const shownEstado = r.estado || "Sin estatus";
                    const st = normalizeText(shownEstado);

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
                            <button
                              type="button"
                              className={`${styles.policyBadge} ${styles.policyBadgeOk} ${styles.policyBadgeButton}`}
                              title={`Ver póliza ${r.poliza}`}
                              onClick={() => void openPolicyPreview(r.poliza)}
                              disabled={loadingPreview}
                            >
                              {r.poliza}
                            </button>
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

                        <td title={r.adquisicion}>
                          <span className={styles.ellipsis}>
                            {r.adquisicion}
                          </span>
                        </td>

                        <td className={styles.mono}>{r.fecha}</td>

                        <td className={styles.statusCell}>
                          <span className={`${styles.badge} ${badgeClass}`}>
                            {shownEstado}
                          </span>
                        </td>

                        <td className={styles.tdRight}>
                          <div className={styles.actionsCell}>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() =>
                                goDetail(r.idRequest, r.adquisicion)
                              }
                              title={`Abrir expediente de solicitud ${r.idRequest}`}
                            >
                              Ver detalle
                            </button>

                            <button
                              type="button"
                              className={styles.deleteIconBtn}
                              onClick={() => openDeleteModal(r)}
                              title={`Eliminar solicitud ${r.folio}`}
                              aria-label={`Eliminar solicitud ${r.folio}`}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
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

      {previewOpen && previewItem && (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Previsualización de póliza"
          onClick={closePreview}
        >
          <div
            className={styles.previewModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div className={styles.previewHeaderInfo}>
                <div className={styles.previewTitle}>Previsualización</div>
                <div className={styles.previewName} title={previewItem.name}>
                  {previewItem.name}
                </div>
              </div>

              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUrl(previewItem.url)}
                >
                  Abrir aparte
                </button>

                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={closePreview}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
              {previewItem.type === "pdf" && (
                <div className={styles.previewPdfWrap}>
                  <iframe
                    src={`${previewItem.url}#view=FitH`}
                    title={previewItem.name}
                    className={styles.previewFrame}
                  />
                </div>
              )}

              {previewItem.type === "image" && (
                <div className={styles.previewImageStage}>
                  <img
                    src={previewItem.url}
                    alt={previewItem.name}
                    className={styles.previewImage}
                  />
                </div>
              )}

              {previewItem.type === "other" && (
                <div className={styles.previewFallback}>
                  <div className={styles.previewFallbackTitle}>
                    No se puede previsualizar este archivo aquí.
                  </div>
                  <div className={styles.previewFallbackText}>
                    Puedes abrirlo en otra pestaña para verlo completo.
                  </div>

                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => openUrl(previewItem.url)}
                  >
                    Abrir archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && deleteTarget && (
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          onClick={closeDeleteModal}
        >
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmHeader}>
              <h3 className={styles.confirmTitle}>Confirmar eliminación</h3>
              <p className={styles.confirmText}>
                Vas a eliminar la adquisición <b>{deleteTarget.folio}</b>. Esta
                acción no se puede deshacer.
              </p>
            </div>

            <div className={styles.confirmBody}>
              <label className={styles.confirmField}>
                <span>Contraseña</span>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                />
              </label>
            </div>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.deleteConfirmBtn}
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && deleteTarget && (
        <div
          className={styles.deleteConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          onClick={closeDeleteModal}
        >
          <div
            className={styles.deleteConfirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteConfirmHeader}>
              <div className={styles.deleteConfirmIcon}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12M10 11v6M14 11v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className={styles.deleteConfirmHeaderText}>
                <div className={styles.deleteConfirmTitle}>
                  Confirmar eliminación
                </div>
                <div className={styles.deleteConfirmSubtitle}>
                  Esta acción eliminará la adquisición seleccionada.
                </div>
              </div>
            </div>

            <div className={styles.deleteConfirmBody}>
              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Folio</div>
                <div
                  className={styles.deleteFileName}
                  title={deleteTarget.folio}
                >
                  {deleteTarget.folio}
                </div>
              </div>

              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Clasificación</div>
                <div
                  className={styles.deleteFileName}
                  title={deleteTarget.adquisicion}
                >
                  {deleteTarget.adquisicion}
                </div>
              </div>

              <div className={styles.deleteFormField}>
                <label className={styles.deleteFieldLabel}>Contraseña</label>
                <input
                  type="password"
                  className={styles.deleteInput}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  disabled={deleting}
                  autoFocus
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !deleting &&
                      deletePassword.trim()
                    ) {
                      void confirmDelete();
                    }
                  }}
                />
              </div>

              <div className={styles.deleteWarningBox}>
                Esta acción no se puede deshacer.
              </div>
            </div>

            <div className={styles.deleteConfirmFooter}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.deleteConfirmBtn}
                onClick={() => void confirmDelete()}
                disabled={deleting || !deletePassword.trim()}
              >
                {deleting ? "Eliminando..." : "Eliminar adquisición"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
