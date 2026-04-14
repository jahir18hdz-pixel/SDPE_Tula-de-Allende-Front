import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "../styles/home.module.css";
import { FiSearch, FiTrash2, FiCalendar } from "react-icons/fi";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import NotificationToast from "../../../Components/layout/NotificationToast";
import CfdiPanel from "../../ExpedientDocument/components/CfdiPanel";
import {
  BASE_URL,
  readToken,
  requestJson,
  authHeaders,
} from "../../../services/api";

type ApiRow = {
  folio?: string | null;
  idRequest?: number;
  IdRequest?: number;
  acquisitionClassification?: string | null;
  AcquisitionClassification?: string | null;
  requestDate?: string | null;
  RequestDate?: string | null;
  completeMaximeDate?: string | null;
  CompleteMaximeDate?: string | null;
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
  fechaLimite: string;
  estado: string;
  requestDateRaw?: string | null;
  maxDateRaw?: string | null;
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

type NotificationSignalRPayload = {
  id: number;
  title?: string | null;
  message: string;
  requestId?: number | null;
  createdAt: string;
};

type EditDateTarget = {
  idRequest: number;
  folio: string;
  fechaActual: string | null;
};

type CfdiFormState = {
  cfdi: string;
};

type CfdiTarget = {
  idRequest: number;
  folio: string;
  cfdiActual: string;
};

const API_BASE = "/api/AcquisitionRequest";
const PAYMENT_POLICY_API = "/api/PaymentPolicy/policies";

function getDaysUntil(dateValue?: string | null) {
  if (!dateValue) return null;

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(target);
  limit.setHours(0, 0, 0, 0);

  const diffMs = limit.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toInputDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function buildNotificationTitle(item: {
  requestId?: number | null;
  message: string;
}) {
  if (item.requestId) return `Solicitud #${item.requestId}`;
  return "Notificación";
}

function getWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateClassification(text: string, maxWords = 3) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const connectionRef = useRef<signalR.HubConnection | null>(null);

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

  const [notificationToast, setNotificationToast] = useState<{
    open: boolean;
    title: string;
    message: string;
    requestId?: number | null;
  }>({
    open: false,
    title: "",
    message: "",
    requestId: null,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [classificationModalText, setClassificationModalText] = useState<
    string | null
  >(null);

  const [editDateModalOpen, setEditDateModalOpen] = useState(false);
  const [editDateTarget, setEditDateTarget] = useState<EditDateTarget | null>(
    null,
  );
  const [editDateValue, setEditDateValue] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const [cfdiPanelOpen, setCfdiPanelOpen] = useState(false);
  const [cfdiTarget, setCfdiTarget] = useState<CfdiTarget | null>(null);
  const [cfdiForm, setCfdiForm] = useState<CfdiFormState>({ cfdi: "" });
  const [savingCfdi, setSavingCfdi] = useState(false);

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const closeNotificationToast = () =>
    setNotificationToast((prev) => ({
      ...prev,
      open: false,
    }));

  const showAppToast = useCallback((message: string, type: ToastType) => {
    setToast({
      open: true,
      type,
      message,
    });
  }, []);

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
        showAppToast(res.error || "Error al cargar adquisiciones.", "error");
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
          const completeMaximeDate =
            x.completeMaximeDate ?? x.CompleteMaximeDate ?? null;

          const estado = (x.status ?? x.Status ?? "").trim() || "Sin estatus";

          return {
            idRequest,
            folio,
            poliza,
            cfdi,
            adquisicion,
            fecha: formatDate(requestDate),
            fechaLimite: formatDate(completeMaximeDate),
            estado,
            requestDateRaw: requestDate,
            maxDateRaw: completeMaximeDate,
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
      showAppToast("Error inesperado al cargar adquisiciones.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageNumber, pageSize, showAppToast]);

  const connectToHub = useCallback(async () => {
    try {
      if (connectionRef.current) return;

      const token = readToken();

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${BASE_URL}/notifications`, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect()
        .build();

      connection.on(
        "ReceiveNotification",
        (notification: NotificationSignalRPayload) => {
          setNotificationToast({
            open: true,
            title:
              notification.title ??
              buildNotificationTitle({
                requestId: notification.requestId ?? null,
                message: notification.message,
              }),
            message: notification.message,
            requestId: notification.requestId ?? null,
          });
        },
      );

      await connection.start();
      connectionRef.current = connection;
    } catch (error) {
      console.error("Error conectando a SignalR:", error);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData, location.key]);

  useEffect(() => {
    void connectToHub();

    return () => {
      const connection = connectionRef.current;
      connectionRef.current = null;

      if (connection) {
        connection.stop().catch(() => undefined);
      }
    };
  }, [connectToHub]);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewItem(null);
  }, []);

  const closeEditDateModal = useCallback(() => {
    if (savingDate) return;
    setEditDateModalOpen(false);
    setEditDateTarget(null);
    setEditDateValue("");
  }, [savingDate]);

  const openEditDateModal = useCallback((row: Row) => {
    setEditDateTarget({
      idRequest: row.idRequest,
      folio: row.folio,
      fechaActual: row.maxDateRaw ?? null,
    });
    setEditDateValue(toInputDate(row.maxDateRaw));
    setEditDateModalOpen(true);
  }, []);

  const openCfdiPanel = useCallback((row: Row) => {
    const currentCfdi = hasCfdi(row.cfdi) ? row.cfdi : "";

    setCfdiTarget({
      idRequest: row.idRequest,
      folio: row.folio,
      cfdiActual: currentCfdi,
    });

    setCfdiForm({
      cfdi: currentCfdi,
    });

    setCfdiPanelOpen(true);
  }, []);

  const closeCfdiPanel = useCallback(() => {
    if (savingCfdi) return;
    setCfdiPanelOpen(false);
    setCfdiForm({ cfdi: "" });
    setCfdiTarget(null);
  }, [savingCfdi]);

  const onSaveMaxDate = useCallback(async () => {
    if (!editDateTarget) return;

    if (!editDateValue) {
      showAppToast("Selecciona una fecha límite.", "error");
      return;
    }

    setSavingDate(true);

    try {
      const newMaxDate = new Date(`${editDateValue}T00:00:00`).toISOString();

      const res = (await requestJson(`${API_BASE}/update-max-date`, {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          requestId: editDateTarget.idRequest,
          newMaxDate,
        }),
      })) as RequestResult;

      if (!res.ok) {
        showAppToast(
          res.error || "No se pudo actualizar la fecha límite.",
          "error",
        );
        return;
      }

      showAppToast("Fecha límite actualizada correctamente.", "success");
      closeEditDateModal();
      await fetchData();
    } catch {
      showAppToast("Error inesperado al actualizar la fecha límite.", "error");
    } finally {
      setSavingDate(false);
    }
  }, [
    editDateTarget,
    editDateValue,
    closeEditDateModal,
    fetchData,
    showAppToast,
  ]);

  const onSaveCfdi = useCallback(async () => {
    if (!cfdiTarget?.idRequest) {
      showAppToast("No se encontró la solicitud para actualizar el CFDI.", "error");
      return;
    }

    if (!cfdiForm.cfdi.trim()) {
      showAppToast("Captura el CFDI.", "error");
      return;
    }

    setSavingCfdi(true);

    try {
      const res = (await requestJson(
        `${API_BASE}/${cfdiTarget.idRequest}/CFDI`,
        {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(cfdiForm.cfdi.trim()),
        },
      )) as RequestResult;

      if (!res.ok) {
        showAppToast(res.error || "No se pudo guardar el CFDI.", "error");
        return;
      }

      showAppToast("CFDI guardado correctamente.", "success");
      closeCfdiPanel();
      await fetchData();
    } catch (error) {
      console.error("Error al actualizar CFDI:", error);
      showAppToast("Error inesperado al actualizar el CFDI.", "error");
    } finally {
      setSavingCfdi(false);
    }
  }, [cfdiTarget, cfdiForm.cfdi, closeCfdiPanel, fetchData, showAppToast]);

  const openUrl = useCallback((u: string) => {
    const url = normalizeUrlMaybe(u);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openPolicyPreview = useCallback(
    async (policyCode: string) => {
      const code = policyCode.trim();

      if (
        !code ||
        code.toLowerCase() === "sin póliza" ||
        code.toLowerCase() === "sin poliza"
      ) {
        showAppToast("Esta adquisición no tiene póliza asignada.", "error");
        return;
      }

      setLoadingPreview(true);

      try {
        const res = (await requestJson(PAYMENT_POLICY_API, {
          method: "GET",
          headers: authHeaders(),
        })) as RequestResult;

        if (!res.ok) {
          showAppToast(
            res.error || "No se pudo consultar la póliza seleccionada.",
            "error",
          );
          return;
        }

        const items = getItemsFromUnknown<PaymentPolicyPreviewRow>(res.data);

        const found = items.find((item) => {
          const currentCode = (item.policyCode ?? item.PolicyCode ?? "").trim();
          return normalizeText(currentCode) === normalizeText(code);
        });

        const previewUrl = normalizeUrlMaybe(
          found?.previewUrl ?? found?.PreviewUrl ?? "",
        );

        if (!previewUrl) {
          showAppToast(
            "La póliza seleccionada no tiene archivo de vista previa.",
            "error",
          );
          return;
        }

        setPreviewItem({
          url: previewUrl,
          name: code,
          type: getPreviewType(previewUrl, code),
        });
        setPreviewOpen(true);
      } catch {
        showAppToast("Error inesperado al consultar la póliza.", "error");
      } finally {
        setLoadingPreview(false);
      }
    },
    [showAppToast],
  );

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

  const onDeleteRequest = useCallback(async () => {
    if (!deleteTarget) return;

    const password = deletePassword.trim();

    if (!password) {
      showAppToast("Ingresa tu contraseña para eliminar.", "error");
      return;
    }

    setDeleting(true);

    try {
      const res = (await requestJson(`${API_BASE}/${deleteTarget.idRequest}`, {
        method: "DELETE",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          password,
        }),
      })) as RequestResult;

      if (!res.ok) {
        showAppToast(res.error || "No se pudo eliminar la solicitud.", "error");
        return;
      }

      showAppToast("Solicitud eliminada correctamente.", "success");
      closeDeleteModal();
      await fetchData();
    } catch {
      showAppToast("Error inesperado al eliminar la solicitud.", "error");
    } finally {
      setDeleting(false);
    }
  }, [deletePassword, deleteTarget, closeDeleteModal, fetchData, showAppToast]);

  useEffect(() => {
    if (
      !previewOpen &&
      !deleteModalOpen &&
      !classificationModalText &&
      !editDateModalOpen &&
      !cfdiPanelOpen
    ) {
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      if (deleteModalOpen) {
        closeDeleteModal();
        return;
      }

      if (editDateModalOpen) {
        closeEditDateModal();
        return;
      }

      if (cfdiPanelOpen) {
        closeCfdiPanel();
        return;
      }

      if (classificationModalText) {
        setClassificationModalText(null);
        return;
      }

      if (previewOpen) {
        closePreview();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    previewOpen,
    deleteModalOpen,
    classificationModalText,
    editDateModalOpen,
    cfdiPanelOpen,
    closeDeleteModal,
    closeEditDateModal,
    closeCfdiPanel,
    closePreview,
  ]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "Todos") {
      list = list.filter(
        (r) => normalizeText(r.estado) === normalizeText(statusFilter),
      );
    }

    const q = normalizeText(query);

    if (q) {
      list = list.filter((r) => {
        const real = r.estado;

        return (
          normalizeText(r.folio).includes(q) ||
          normalizeText(r.poliza).includes(q) ||
          normalizeText(r.cfdi).includes(q) ||
          normalizeText(r.adquisicion).includes(q) ||
          normalizeText(r.fecha).includes(q) ||
          normalizeText(r.fechaLimite).includes(q) ||
          normalizeText(real).includes(q)
        );
      });
    }

    list.sort((a, b) => {
      const statusA = normalizeText(a.estado);
      const statusB = normalizeText(b.estado);

      const aIsComplete = statusA === "completo";
      const bIsComplete = statusB === "completo";

      if (aIsComplete !== bIsComplete) {
        return aIsComplete ? 1 : -1;
      }

      const dateA = a.requestDateRaw ? new Date(a.requestDateRaw).getTime() : 0;
      const dateB = b.requestDateRaw ? new Date(b.requestDateRaw).getTime() : 0;

      return dateB - dateA;
    });

    return list;
  }, [rows, query, statusFilter]);

  const kpiTotal = filtered.length;

  const kpiCompleto = filtered.filter(
    (r) => normalizeText(r.estado) === "completo",
  ).length;

  const kpiIncompleto = filtered.filter(
    (r) => normalizeText(r.estado) === "incompleto",
  ).length;

  const kpiObservados = filtered.filter((r) => {
    const estado = normalizeText(r.estado);
    return estado.includes("observado");
  }).length;

  const kpiRevision = filtered.filter((r) => {
    const estado = normalizeText(r.estado);
    return (
      estado.includes("revision") ||
      estado.includes("revisión") ||
      estado.includes("en revision") ||
      estado.includes("en revisión")
    );
  }).length;

  function goRegister() {
    navigate("/adquisiciones/registrar");
  }

  function goDetail(idRequest: number, classificationLabel: string) {
    if (!hasValidClassification(classificationLabel)) {
      showAppToast(
        "Esta solicitud no tiene clasificación asignada. No se puede generar el checklist del expediente.",
        "error",
      );
      return;
    }

    navigate(`/adquisiciones/${idRequest}/expediente`);
  }

  const isAnyModalOpen =
    previewOpen ||
    deleteModalOpen ||
    !!classificationModalText ||
    editDateModalOpen ||
    cfdiPanelOpen;

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

      <NotificationToast
        open={notificationToast.open}
        title={notificationToast.title}
        message={notificationToast.message}
        onClose={closeNotificationToast}
        onView={() => {
          if (notificationToast.requestId) {
            navigate(
              `/adquisiciones/${notificationToast.requestId}/expediente`,
            );
            closeNotificationToast();
          }
        }}
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

            <div className={`${styles.kpiObserved} ${styles.kpiObserved}`}>
              <span className={styles.kpiLabel}>Observados</span>
              <span className={styles.kpiValue}>{kpiObservados}</span>
            </div>

            <div className={`${styles.kpiReview} ${styles.kpiReview}`}>
              <span className={styles.kpiLabel}>En revisión</span>
              <span className={styles.kpiValue}>{kpiRevision}</span>
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <FiSearch className={styles.searchIcon} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por folio, póliza, CFDI, clasificación, estado, fecha límite…"
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
                  <th>Fecha límite</th>
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
                    const shownEstado = r.estado || "Sin estatus";
                    const st = normalizeText(shownEstado);

                    const badgeClass =
                      st === "completo"
                        ? styles.badgeOk
                        : st === "incompleto"
                          ? styles.badgeBad
                          : st.includes("revision") || st.includes("revisión")
                            ? styles.badgeReview
                            : st.includes("observado")
                              ? styles.badgeObserved
                              : styles.badgeNeutral;

                    const policyExists = hasPolicy(r.poliza);
                    const cfdiExists = hasCfdi(r.cfdi);
                    const daysUntilLimit = getDaysUntil(r.maxDateRaw);

                    const deadlineClass =
                      daysUntilLimit !== null && daysUntilLimit <= 3
                        ? styles.badgeDeadlineUrgent
                        : styles.badgeDeadline;

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
                          <button
                            type="button"
                            className={`${styles.policyBadge} ${
                              cfdiExists
                                ? styles.policyBadgeOk
                                : styles.policyBadgeEmpty
                            } ${styles.policyBadgeButton}`}
                            title={
                              cfdiExists
                                ? `Editar CFDI ${r.cfdi}`
                                : "Agregar CFDI"
                            }
                            onClick={() => openCfdiPanel(r)}
                          >
                            {cfdiExists ? r.cfdi : "Sin CFDI"}
                          </button>
                        </td>

                        <td>
                          {getWordCount(r.adquisicion) > 3 ? (
                            <button
                              type="button"
                              className={styles.classificationBtn}
                              onClick={() =>
                                setClassificationModalText(r.adquisicion)
                              }
                              title={r.adquisicion}
                            >
                              {truncateClassification(r.adquisicion, 3)}
                            </button>
                          ) : (
                            <span
                              title={r.adquisicion}
                              className={styles.ellipsis}
                            >
                              {r.adquisicion}
                            </span>
                          )}
                        </td>

                        <td className={styles.statusCell}>
                          <button
                            type="button"
                            className={`${styles.badge} ${deadlineClass} ${styles.deadlineButton}`}
                            onClick={() => openEditDateModal(r)}
                            title={`Editar fecha límite de ${r.folio}`}
                          >
                            <span>{r.fechaLimite}</span>
                          </button>
                        </td>

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
                              title={`Abrir expediente de solicitud ${r.folio}`}
                            >
                              Ver expediente
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
            <span className={styles.pageInfo}>Página {pageNumber}</span>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1 || loading}
            >
              Anterior
            </button>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPageNumber((p) => p + 1)}
              disabled={!hasNext || loading}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {classificationModalText && (
        <div
          className={styles.classificationOverlay}
          onClick={() => setClassificationModalText(null)}
        >
          <div
            className={styles.classificationModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.classificationModalHeader}>
              <div className={styles.classificationModalTitle}>
                Clasificación completa
              </div>

              <button
                type="button"
                className={styles.classificationCloseBtn}
                onClick={() => setClassificationModalText(null)}
              >
                Cerrar
              </button>
            </div>

            <div className={styles.classificationModalBody}>
              {classificationModalText}
            </div>
          </div>
        </div>
      )}

      {previewOpen && previewItem && (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de póliza"
          onClick={closePreview}
        >
          <div
            className={styles.previewModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div className={styles.previewHeaderInfo}>
                <div className={styles.previewTitle}>Vista previa</div>
                <div className={styles.previewName} title={previewItem.name}>
                  {previewItem.name}
                </div>
              </div>

              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={closePreview}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUrl(previewItem.url)}
                >
                  Abrir aparte
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
              {previewItem.type === "image" && (
                <div className={styles.previewImageStage}>
                  <img
                    src={previewItem.url}
                    alt={previewItem.name}
                    className={styles.previewImage}
                  />
                </div>
              )}

              {previewItem.type === "pdf" && (
                <div className={styles.previewPdfWrap}>
                  <iframe
                    src={`${previewItem.url}#view=FitH`}
                    title={previewItem.name}
                    className={styles.previewFrame}
                  />
                </div>
              )}

              {previewItem.type === "other" && (
                <div className={styles.previewFallback}>
                  <div className={styles.previewFallbackTitle}>
                    No se puede previsualizar este tipo de archivo aquí.
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

      {editDateModalOpen && editDateTarget && (
        <div
          className={styles.deleteConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Editar fecha límite"
          onClick={closeEditDateModal}
        >
          <div
            className={styles.deleteConfirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteConfirmHeader}>
              <div className={styles.deleteConfirmIcon}>
                <FiCalendar size={22} />
              </div>

              <div className={styles.deleteConfirmHeaderText}>
                <div className={styles.deleteConfirmTitle}>
                  Editar fecha límite
                </div>
                <div className={styles.deleteConfirmSubtitle}>
                  Modifica la fecha máxima de entrega de la adquisición.
                </div>
              </div>
            </div>

            <div className={styles.deleteConfirmBody}>
              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Solicitud</div>
                <div className={styles.deleteFileName}>
                  {editDateTarget.folio}
                </div>
              </div>

              <div className={styles.deleteFormField}>
                <label className={styles.deleteFieldLabel}>Fecha límite</label>
                <div className={styles.dateWrapper}>
                  <input
                    type="date"
                    className={styles.deleteInput}
                    value={editDateValue}
                    onChange={(e) => setEditDateValue(e.target.value)}
                    disabled={savingDate}
                  />

                  <FiCalendar className={styles.dateCustomIcon} />
                </div>
              </div>

              <div className={styles.deleteWarningBox}>
                Fecha actual: {formatDate(editDateTarget.fechaActual)}
              </div>
            </div>

            <div className={styles.deleteConfirmFooter}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeEditDateModal}
                disabled={savingDate}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void onSaveMaxDate()}
                disabled={savingDate || !editDateValue}
              >
                {savingDate ? "Guardando..." : "Guardar fecha"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CfdiPanel
        open={cfdiPanelOpen}
        savingCfdi={savingCfdi}
        cfdi={cfdiTarget?.cfdiActual ?? ""}
        cfdiForm={cfdiForm}
        setCfdiForm={setCfdiForm}
        onClose={closeCfdiPanel}
        onSave={() => void onSaveCfdi()}
      />

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
                  Esta acción eliminará la solicitud seleccionada.
                </div>
              </div>
            </div>

            <div className={styles.deleteConfirmBody}>
              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Solicitud</div>
                <div
                  className={styles.deleteFileName}
                  title={`${deleteTarget.folio} - ${deleteTarget.adquisicion}`}
                >
                  {deleteTarget.folio} - {deleteTarget.adquisicion}
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
                    if (e.key === "Enter" && !deleting) {
                      void onDeleteRequest();
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
                onClick={() => void onDeleteRequest()}
                disabled={deleting || !deletePassword.trim()}
              >
                {deleting ? "Eliminando..." : "Eliminar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}