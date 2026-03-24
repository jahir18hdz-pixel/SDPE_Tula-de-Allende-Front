import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "../styles/ExpedientDocuments.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type ChecklistFileItem = {
  id: number | null;
  name: string;
  url: string;
  previewUrl?: string | null;
};

type ChecklistRow = {
  documentTypeId: number;
  documentName: string;
  requiredByRule: boolean;
  noApplies: boolean;
  uploaded: boolean;
  observations: string[];
  reviewObservations: string[];
  statusDescriptions: string[];
  files: ChecklistFileItem[];
};

type UploadRow = {
  file: File;
  documentTypeId: number | null;
  observations: string;
};

type RequestOk = { ok: true; data: unknown; status: number };
type RequestErr = { ok: false; error: string; status: number };
type RequestResult = RequestOk | RequestErr;

type ManagerInfo = {
  idRequestManager: number;
  fullName: string;
  requestNumber?: string | null;
  administrativeUnit?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AdministrativeUnitOption = {
  idAdministrativeUnit: number;
  description: string;
};

type ManagerFormState = {
  idRequestManager: number | null;
  idAdministrativeUnit: number | null;
  firstName: string;
  lastName: string;
  secondLastName: string;
  email: string;
  phone: string;
};

type PaymentPolicyOption = {
  idPaymentPolicy: number;
  policyCode: string;
  description?: string | null;
};

type PolicyFormState = {
  idPaymentPolicy: number | null;
};

type CfdiFormState = {
  cfdi: string;
};

type ChecklistExceptionRow = {
  documentTypeId: number;
  documentName: string;
  doesNotApply: boolean;
  justification: string;
  uploaded: boolean;
};

type PreviewItem = {
  id: number | null;
  url: string;
  name: string;
  type: "image" | "pdf" | "other";
  reviewObservation?: string | null;
  reviewStatus?: string | null;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  return asArray(
    payload["items"] ??
      payload["Items"] ??
      payload["data"] ??
      payload["Data"] ??
      payload["result"] ??
      payload["Result"],
  );
}

function toStringSafe(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
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

function normalizeUrlMaybe(u: string) {
  return (u ?? "").trim();
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => toStringSafe(x).trim()).filter(Boolean);
}

function toStatusDescriptions(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (!isRecord(item)) return "";
      const description = toStringSafe(
        item["description"] ?? item["Description"],
      ).trim();
      const code = toStringSafe(item["code"] ?? item["Code"]).trim();
      return description || code;
    })
    .filter(Boolean);
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

function normalizeChecklist(payload: unknown): ChecklistRow[] {
  const list = unwrapList(payload);

  return list
    .map((raw): ChecklistRow | null => {
      if (!isRecord(raw)) return null;

      const documentTypeId = toNumber(
        raw["documentTypeId"] ??
          raw["DocumentTypeId"] ??
          raw["idDocumentType"] ??
          raw["IdDocumentType"],
      );

      const documentName = toStringSafe(
        raw["documentName"] ??
          raw["DocumentName"] ??
          raw["documentTypeName"] ??
          raw["DocumentTypeName"],
      ).trim();

      if (!documentTypeId || !documentName) return null;

      const requiredByRule = toBool(
        raw["requiredByRule"] ??
          raw["RequiredByRule"] ??
          raw["isRequired"] ??
          raw["IsRequired"] ??
          raw["obligatorio"] ??
          raw["Obligatorio"],
      );

      const noApplies = toBool(
        raw["noApplies"] ??
          raw["NoApplies"] ??
          raw["noAplica"] ??
          raw["NoAplica"] ??
          raw["doesNotApply"] ??
          raw["DoesNotApply"],
      );

      const uploaded = toBool(
        raw["uploaded"] ??
          raw["Uploaded"] ??
          raw["hasFile"] ??
          raw["HasFile"] ??
          raw["active"] ??
          raw["Active"],
      );

      const observations = toStringArray(
        raw["observations"] ?? raw["Observations"],
      );

      const reviewObservations = toStringArray(
        raw["observationsUpload"] ?? raw["ObservationsUpload"],
      );

      const statusDescriptions = toStatusDescriptions(
        raw["status"] ?? raw["Status"],
      );

      const fileIdsRaw = asArray(raw["fileIds"] ?? raw["FileIds"]);
      const fileNames = toStringArray(raw["fileNames"] ?? raw["FileNames"]);
      const fileUrls = toStringArray(raw["fileUrls"] ?? raw["FileUrls"]);
      const previewUrls = toStringArray(
        raw["previewUrls"] ?? raw["PreviewUrls"],
      );

      const maxLen = Math.max(
        fileIdsRaw.length,
        fileNames.length,
        fileUrls.length,
        previewUrls.length,
      );

      const files: ChecklistFileItem[] = Array.from(
        { length: maxLen },
        (_, i) => {
          const id = toNumber(fileIdsRaw[i]);
          const url = normalizeUrlMaybe(fileUrls[i] ?? "");
          const previewUrl = normalizeUrlMaybe(previewUrls[i] ?? "");
          const name = (fileNames[i] ?? "").trim() || `Archivo ${i + 1}`;

          return {
            id,
            name,
            url,
            previewUrl: previewUrl || null,
          };
        },
      ).filter((x) => x.url || x.previewUrl);

      return {
        documentTypeId,
        documentName,
        requiredByRule,
        noApplies,
        uploaded,
        observations,
        reviewObservations,
        statusDescriptions,
        files,
      };
    })
    .filter((x): x is ChecklistRow => x !== null);
}

function bytesToHuman(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getManagerDisplayName(m: ManagerInfo | null) {
  return m?.fullName?.trim() || "Sin responsable";
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts[1] ?? "",
    secondLastName: parts.slice(2).join(" ") ?? "",
  };
}

const EXPEDIENT_API = "/api/expedient-documents";
const MANAGER_API = "/api/RequestManager";
const REQUEST_DETAIL_API = "/api/AcquisitionRequest";
const ADMIN_UNIT_API = "/api/AdministrativeUnit";
const PAYMENT_POLICY_API = "/api/PaymentPolicy";
const REQUEST_DOCUMENT_EXCEPTION_API = "/api/RequestDocumentException";
const DOCUMENT_STATUS_APPROVED = 2;
const DOCUMENT_STATUS_REJECTED = 3;

export default function ExpedientDocuments() {
  const navigate = useNavigate();
  const params = useParams();

  const requestId = useMemo(() => {
    const raw = (params.id ??
      params.requestId ??
      params.requestID ??
      "") as string;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [params]);

  const canUse = requestId > 0;

  const [requestNumber, setRequestNumber] = useState<string>("");
  const [policyNumber, setPolicyNumber] = useState<string>("");
  const [cfdi, setCfdi] = useState<string>("");

  const [loadingManager, setLoadingManager] = useState(false);
  const [manager, setManager] = useState<ManagerInfo | null>(null);

  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [searchText, setSearchText] = useState("");

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [deletingPreview, setDeletingPreview] = useState(false);
  const [reviewingDocument, setReviewingDocument] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectObservations, setRejectObservations] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreviewItem | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const [managerPanelOpen, setManagerPanelOpen] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [loadingAdministrativeUnits, setLoadingAdministrativeUnits] =
    useState(false);
  const [administrativeUnits, setAdministrativeUnits] = useState<
    AdministrativeUnitOption[]
  >([]);
  const [managerForm, setManagerForm] = useState<ManagerFormState>({
    idRequestManager: null,
    idAdministrativeUnit: null,
    firstName: "",
    lastName: "",
    secondLastName: "",
    email: "",
    phone: "",
  });

  const [policyPanelOpen, setPolicyPanelOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [paymentPolicies, setPaymentPolicies] = useState<PaymentPolicyOption[]>(
    [],
  );
  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    idPaymentPolicy: null,
  });

  const [cfdiPanelOpen, setCfdiPanelOpen] = useState(false);
  const [savingCfdi, setSavingCfdi] = useState(false);
  const [cfdiForm, setCfdiForm] = useState<CfdiFormState>({
    cfdi: "",
  });

  const [checklistPanelOpen, setChecklistPanelOpen] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [checklistExceptionRows, setChecklistExceptionRows] = useState<
    ChecklistExceptionRow[]
  >([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const openUrl = useCallback(
    (u: string) => {
      const url = normalizeUrlMaybe(u);
      if (!url) {
        showToast("error", "No hay archivo para abrir.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [showToast],
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewItems([]);
    setPreviewIndex(0);
    setAutoPlay(true);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeletePassword("");
    setShowRejectBox(false);
    setRejectObservations("");
  }, []);

  const closeManagerPanel = useCallback(() => {
    setManagerPanelOpen(false);
  }, []);

  const closePolicyPanel = useCallback(() => {
    setPolicyPanelOpen(false);
  }, []);

  const closeCfdiPanel = useCallback(() => {
    setCfdiPanelOpen(false);
  }, []);

  const closeChecklistPanel = useCallback(() => {
    setChecklistPanelOpen(false);
  }, []);

  const openDeleteModal = useCallback(
    (item: PreviewItem) => {
      if (!item.id) {
        showToast(
          "error",
          "No se puede eliminar este archivo porque no tiene identificador.",
        );
        return;
      }

      setDeleteTarget(item);
      setDeletePassword("");
      setDeleteModalOpen(true);
    },
    [showToast],
  );

  const closeDeleteModal = useCallback(() => {
    if (deletingPreview) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeletePassword("");
  }, [deletingPreview]);

  const loadRequestDetail = useCallback(async () => {
    if (!canUse) return;

    try {
      const res = (await requestJson(`${REQUEST_DETAIL_API}/${requestId}`, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

      if (!res.ok) {
        setRequestNumber("");
        setPolicyNumber("");
        setCfdi("");
        return;
      }

      const data = res.data;

      const rn =
        (isRecord(data)
          ? toStringSafe(
              data["requestNumber"] ??
                data["RequestNumber"] ??
                data["numeroSolicitud"] ??
                data["NumeroSolicitud"] ??
                data["folio"] ??
                data["Folio"],
            )
          : ""
        ).trim() || "";

      const pn =
        (isRecord(data)
          ? toStringSafe(
              data["policyNumber"] ??
                data["PolicyNumber"] ??
                data["paymentPolicy"] ??
                data["PaymentPolicy"],
            )
          : ""
        ).trim() || "";

      const cfdiValue =
        (isRecord(data)
          ? toStringSafe(
              data["cfdi"] ?? data["CFDI"] ?? data["cdfi"] ?? data["CDFI"],
            )
          : ""
        ).trim() || "";

      setRequestNumber(rn);
      setPolicyNumber(pn);
      setCfdi(cfdiValue);
    } catch {
      setRequestNumber("");
      setPolicyNumber("");
      setCfdi("");
    }
  }, [canUse, requestId]);

  const loadManager = useCallback(async () => {
    if (!canUse) return;

    setLoadingManager(true);
    try {
      const res = (await requestJson(MANAGER_API, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

      if (!res.ok) {
        setManager(null);
        return;
      }

      const list = unwrapList(res.data);

      let found: UnknownRecord | null =
        (list.find((x) => {
          if (!isRecord(x)) return false;
          const rn = toStringSafe(
            x["requestNumber"] ?? x["RequestNumber"],
          ).trim();
          return rn === String(requestId);
        }) as UnknownRecord) ?? null;

      if (!found && requestNumber) {
        found =
          (list.find((x) => {
            if (!isRecord(x)) return false;
            const rn = toStringSafe(
              x["requestNumber"] ?? x["RequestNumber"],
            ).trim();
            return rn === requestNumber;
          }) as UnknownRecord) ?? null;
      }

      if (!found) {
        setManager(null);
        return;
      }

      const idRequestManager = toNumber(
        found["idRequestManager"] ?? found["IdRequestManager"],
      );
      const fullName = toStringSafe(
        found["fullName"] ?? found["FullName"],
      ).trim();
      const administrativeUnit =
        toStringSafe(
          found["administrativeUnit"] ?? found["AdministrativeUnit"],
        ).trim() || null;
      const reqNum =
        toStringSafe(found["requestNumber"] ?? found["RequestNumber"]).trim() ||
        null;
      const email =
        toStringSafe(found["email"] ?? found["Email"]).trim() || null;
      const phone =
        toStringSafe(found["phone"] ?? found["Phone"]).trim() || null;

      if (!idRequestManager || !fullName) {
        setManager(null);
        return;
      }

      setManager({
        idRequestManager,
        fullName,
        requestNumber: reqNum,
        administrativeUnit,
        email,
        phone,
      });
    } catch {
      setManager(null);
    } finally {
      setLoadingManager(false);
    }
  }, [canUse, requestId, requestNumber]);

  const loadChecklist = useCallback(async () => {
    if (!canUse) return;

    setLoadingChecklist(true);
    try {
      const res = (await requestJson(
        `${EXPEDIENT_API}/requests/${requestId}/checklist`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      )) as RequestResult;

      if (!res.ok) {
        setChecklist([]);
        showToast("error", res.error || "No se pudo cargar el checklist.");
        return;
      }

      const list = normalizeChecklist(res.data);

      list.sort((a, b) => {
        const aRequiredApplies = a.requiredByRule && !a.noApplies;
        const bRequiredApplies = b.requiredByRule && !b.noApplies;

        if (a.noApplies !== b.noApplies) return a.noApplies ? 1 : -1;
        if (aRequiredApplies !== bRequiredApplies)
          return aRequiredApplies ? -1 : 1;

        if (aRequiredApplies && bRequiredApplies && a.uploaded !== b.uploaded) {
          return a.uploaded ? 1 : -1;
        }

        if (
          !aRequiredApplies &&
          !bRequiredApplies &&
          a.uploaded !== b.uploaded
        ) {
          return a.uploaded ? 1 : -1;
        }

        return a.documentName.localeCompare(b.documentName, "es");
      });

      setChecklist(list);
    } catch {
      setChecklist([]);
      showToast("error", "Error inesperado al cargar el checklist.");
    } finally {
      setLoadingChecklist(false);
    }
  }, [canUse, requestId, showToast]);

  useEffect(() => {
    if (!canUse) return;
    void loadRequestDetail();
  }, [canUse, loadRequestDetail]);

  useEffect(() => {
    if (!canUse) return;
    void loadManager();
  }, [canUse, loadManager]);

  useEffect(() => {
    if (!canUse) return;
    void loadChecklist();
  }, [canUse, loadChecklist]);

  const stats = useMemo(() => {
    const required = checklist.filter(
      (x) => x.requiredByRule && !x.noApplies,
    ).length;
    const uploadedOk = checklist.filter((x) => x.uploaded).length;
    const requiredUploaded = checklist.filter(
      (x) => x.requiredByRule && !x.noApplies && x.uploaded,
    ).length;
    const missingRequired = Math.max(0, required - requiredUploaded);
    return { required, uploadedOk, requiredUploaded, missingRequired };
  }, [checklist]);

  const filteredChecklist = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return checklist;
    return checklist.filter((c) => c.documentName.toLowerCase().includes(q));
  }, [checklist, searchText]);

  const checklistOptions = useMemo(() => {
    return checklist.map((c) => ({
      id: c.documentTypeId,
      name: c.documentName,
      required: c.requiredByRule && !c.noApplies,
      uploaded: c.uploaded,
      noApplies: c.noApplies,
    }));
  }, [checklist]);

  const currentPreview = previewItems[previewIndex] ?? null;
  const isImagePreview = currentPreview?.type === "image";
  const isPdfPreview = currentPreview?.type === "pdf";
  const canMovePreview = previewItems.length > 1;
  const hasReviewObservation = Boolean(
    currentPreview?.reviewObservation?.trim(),
  );
  const hasPreviewInfo = Boolean(currentPreview);

  const openPreviewFromFiles = useCallback(
    (row: ChecklistRow, selectedIndex = 0) => {
      const { documentName, files, reviewObservations, statusDescriptions } =
        row;

      if (!files.length) {
        showToast("error", "No hay archivo para previsualizar.");
        return;
      }

      const mapped: PreviewItem[] = files
        .map((file, idx) => {
          const viewUrl = normalizeUrlMaybe(file.previewUrl || file.url);
          const name = file.name?.trim() || `${documentName} ${idx + 1}`;

          return {
            id: file.id ?? null,
            url: viewUrl,
            name,
            type: getPreviewType(viewUrl, name),
            reviewObservation: reviewObservations[idx] ?? null,
            reviewStatus:
              statusDescriptions[idx] ?? statusDescriptions[0] ?? null,
          };
        })
        .filter((x) => x.url);

      if (!mapped.length) {
        showToast("error", "No hay archivo para previsualizar.");
        return;
      }

      const safeIndex =
        selectedIndex >= 0 && selectedIndex < mapped.length ? selectedIndex : 0;

      setPreviewItems(mapped);
      setPreviewIndex(safeIndex);
      setAutoPlay(mapped[safeIndex]?.type === "image" && mapped.length > 1);
      setPreviewOpen(true);
    },
    [showToast],
  );

  const goPrevPreview = useCallback(() => {
    setPreviewIndex((prev) => {
      if (previewItems.length === 0) return 0;
      return prev === 0 ? previewItems.length - 1 : prev - 1;
    });
  }, [previewItems.length]);

  const goNextPreview = useCallback(() => {
    setPreviewIndex((prev) => {
      if (previewItems.length === 0) return 0;
      return prev === previewItems.length - 1 ? 0 : prev + 1;
    });
  }, [previewItems.length]);

  const onDeletePreviewDocumentByItem = useCallback(
    async (item: PreviewItem, password: string) => {
      if (!item.id) {
        showToast(
          "error",
          "No se puede eliminar este archivo porque no tiene identificador.",
        );
        return;
      }

      if (!password.trim()) {
        showToast(
          "error",
          "Debes capturar la contraseña para eliminar el archivo.",
        );
        return;
      }

      setDeletingPreview(true);

      try {
        const res = (await requestJson(`${EXPEDIENT_API}/${item.id}`, {
          method: "DELETE",
          headers: authHeaders(),
          body: JSON.stringify({ password: password.trim() }),
        })) as RequestResult;

        if (!res.ok) {
          showToast("error", res.error || "No se pudo eliminar el documento.");
          return;
        }

        showToast("success", "Documento eliminado correctamente.");

        const nextItems = previewItems.filter((x) => x.id !== item.id);

        if (nextItems.length === 0) {
          closePreview();
        } else {
          const removedIndex = previewItems.findIndex((x) => x.id === item.id);
          setPreviewItems(nextItems);
          setPreviewIndex((prev) => {
            const safePrev =
              removedIndex >= 0 ? Math.min(prev, removedIndex) : prev;
            return Math.max(0, Math.min(safePrev, nextItems.length - 1));
          });
        }

        setDeleteModalOpen(false);
        setDeleteTarget(null);
        setDeletePassword("");

        await loadChecklist();
      } catch {
        showToast("error", "Error inesperado al eliminar el documento.");
      } finally {
        setDeletingPreview(false);
      }
    },
    [previewItems, closePreview, loadChecklist, showToast],
  );

  const onReviewPreviewDocument = useCallback(
    async (
      item: PreviewItem,
      documentStatusId: number,
      observations?: string,
    ) => {
      if (!item.id) {
        showToast(
          "error",
          "No se puede revisar este archivo porque no tiene identificador.",
        );
        return;
      }

      if (
        documentStatusId === DOCUMENT_STATUS_REJECTED &&
        !observations?.trim()
      ) {
        showToast(
          "error",
          "Debes escribir las observaciones de la denegación.",
        );
        return;
      }

      setReviewingDocument(true);

      try {
        const res = (await requestJson(
          `${EXPEDIENT_API}/expedient-documents/${item.id}/review`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              DocumentStatusId: documentStatusId,
              Observations:
                documentStatusId === DOCUMENT_STATUS_REJECTED
                  ? (observations?.trim() ?? "")
                  : null,
            }),
          },
        )) as RequestResult;

        if (!res.ok) {
          showToast("error", res.error || "No se pudo revisar el documento.");
          return;
        }

        showToast(
          "success",
          documentStatusId === DOCUMENT_STATUS_APPROVED
            ? "Documento aprobado correctamente."
            : "Documento denegado correctamente.",
        );

        setShowRejectBox(false);
        setRejectObservations("");
        await loadChecklist();
        closePreview();
      } catch {
        showToast("error", "Error inesperado al revisar el documento.");
      } finally {
        setReviewingDocument(false);
      }
    },
    [closePreview, loadChecklist, showToast],
  );

  useEffect(() => {
    if (!previewOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteModalOpen) {
          closeDeleteModal();
          return;
        }
        if (showRejectBox) {
          setShowRejectBox(false);
          setRejectObservations("");
          return;
        }
        closePreview();
      }
      if (e.key === "ArrowLeft" && canMovePreview && !deleteModalOpen)
        goPrevPreview();
      if (e.key === "ArrowRight" && canMovePreview && !deleteModalOpen)
        goNextPreview();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    previewOpen,
    deleteModalOpen,
    closeDeleteModal,
    closePreview,
    canMovePreview,
    goPrevPreview,
    goNextPreview,
    showRejectBox,
  ]);

  useEffect(() => {
    if (
      !previewOpen ||
      !autoPlay ||
      !isImagePreview ||
      previewItems.length <= 1 ||
      deleteModalOpen
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % previewItems.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [
    previewOpen,
    autoPlay,
    isImagePreview,
    previewItems.length,
    deleteModalOpen,
  ]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    setUploads((prev) => [
      ...prev,
      ...arr.map((f) => ({
        file: f,
        documentTypeId: null,
        observations: "No hay observaciones",
      })),
    ]);

    setShowUploadPanel(true);
    showToast("success", `${arr.length} archivo(s) agregados.`);
  }

  function onPickFiles() {
    fileInputRef.current?.click();
  }

  function onRemoveUpload(idx: number) {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  }

  function onBindFromChecklist(uploadIdx: number, docTypeId: number | null) {
    setUploads((prev) =>
      prev.map((u, i) =>
        i === uploadIdx ? { ...u, documentTypeId: docTypeId } : u,
      ),
    );
  }

  function openChecklistPanel() {
    if (!canUse) return;

    const rows: ChecklistExceptionRow[] = checklist
      .filter((item) => item.requiredByRule)
      .map((item) => ({
        documentTypeId: item.documentTypeId,
        documentName: item.documentName,
        doesNotApply: item.noApplies,
        justification: item.observations.join(" | ").trim() || "No aplica",
        uploaded: item.uploaded,
      }));

    rows.sort((a, b) => a.documentName.localeCompare(b.documentName, "es"));

    setChecklistExceptionRows(rows);
    setChecklistPanelOpen(true);
  }

  async function onSaveChecklistExceptions() {
    if (!canUse) {
      showToast("error", "Solicitud inválida.");
      return;
    }

    const rowsToSave = checklistExceptionRows.filter((row) => row.doesNotApply);
    const invalidRow = rowsToSave.find((row) => !row.justification.trim());

    if (invalidRow) {
      showToast(
        "error",
        `Captura la justificación del documento "${invalidRow.documentName}".`,
      );
      return;
    }

    setSavingChecklist(true);

    try {
      const payload = {
        idRequest: requestId,
        documents: checklistExceptionRows.map((row) => ({
          idDocumentType: row.documentTypeId,
          doesNotApply: row.doesNotApply,
          justification: row.doesNotApply ? row.justification.trim() : "",
        })),
      };

      const res = (await requestJson(
        `${REQUEST_DOCUMENT_EXCEPTION_API}/toggle`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        },
      )) as RequestResult;

      if (!res.ok) {
        showToast(
          "error",
          res.error || "No se pudo guardar la edición del checklist.",
        );
        return;
      }

      showToast("success", "Checklist actualizado correctamente.");
      setChecklistPanelOpen(false);
      await loadChecklist();
    } catch {
      showToast(
        "error",
        "Error inesperado al guardar la edición del checklist.",
      );
    } finally {
      setSavingChecklist(false);
    }
  }

  async function openManagerPanel() {
    if (!canUse) return;

    let units = administrativeUnits;

    if (units.length === 0) {
      setLoadingAdministrativeUnits(true);
      try {
        const res = (await requestJson(ADMIN_UNIT_API, {
          method: "GET",
          headers: authHeaders(),
        })) as RequestResult;

        if (res.ok) {
          const list = unwrapList(res.data);

          units = list
            .map((raw): AdministrativeUnitOption | null => {
              if (!isRecord(raw)) return null;

              const idAdministrativeUnit = toNumber(
                raw["idAdministrativeUnit"] ??
                  raw["IdAdministrativeUnit"] ??
                  raw["id"] ??
                  raw["Id"],
              );

              const description = toStringSafe(
                raw["description"] ??
                  raw["Description"] ??
                  raw["descripcion"] ??
                  raw["Descripcion"],
              ).trim();

              if (!idAdministrativeUnit || !description) return null;

              return { idAdministrativeUnit, description };
            })
            .filter((x): x is AdministrativeUnitOption => x !== null);

          setAdministrativeUnits(units);
        }
      } catch {
        units = [];
      } finally {
        setLoadingAdministrativeUnits(false);
      }
    }

    if (manager) {
      const nameParts = splitFullName(manager.fullName);

      const matchedUnit =
        units.find(
          (u) =>
            u.description.trim().toLowerCase() ===
            (manager.administrativeUnit ?? "").trim().toLowerCase(),
        ) ?? null;

      setManagerForm({
        idRequestManager: manager.idRequestManager,
        idAdministrativeUnit: matchedUnit?.idAdministrativeUnit ?? null,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        secondLastName: nameParts.secondLastName,
        email: manager.email ?? "",
        phone: manager.phone ?? "",
      });
    } else {
      setManagerForm({
        idRequestManager: null,
        idAdministrativeUnit: null,
        firstName: "",
        lastName: "",
        secondLastName: "",
        email: "",
        phone: "",
      });
    }

    setManagerPanelOpen(true);
  }

  async function openPolicyPanel() {
    if (!canUse) return;

    let policies = paymentPolicies;

    if (policies.length === 0) {
      setLoadingPolicies(true);
      try {
        const res = (await requestJson(
          `${PAYMENT_POLICY_API}/available-policies`,
          {
            method: "GET",
            headers: authHeaders(),
          },
        )) as RequestResult;

        if (res.ok) {
          const list = unwrapList(res.data);

          policies = list
            .map((raw): PaymentPolicyOption | null => {
              if (!isRecord(raw)) return null;

              const idPaymentPolicy = toNumber(
                raw["idPaymentPolicy"] ??
                  raw["IdPaymentPolicy"] ??
                  raw["id"] ??
                  raw["Id"],
              );

              const policyCode = toStringSafe(
                raw["policyCode"] ??
                  raw["PolicyCode"] ??
                  raw["code"] ??
                  raw["Code"],
              ).trim();

              const description =
                toStringSafe(
                  raw["description"] ??
                    raw["Description"] ??
                    raw["name"] ??
                    raw["Name"],
                ).trim() || null;

              if (!idPaymentPolicy || !policyCode) return null;

              return {
                idPaymentPolicy,
                policyCode,
                description,
              };
            })
            .filter((x): x is PaymentPolicyOption => x !== null);

          setPaymentPolicies(policies);
        }
      } catch {
        policies = [];
      } finally {
        setLoadingPolicies(false);
      }
    }

    const matchedPolicy =
      policies.find(
        (p) =>
          p.policyCode.trim().toLowerCase() ===
          policyNumber.trim().toLowerCase(),
      ) ?? null;

    setPolicyForm({
      idPaymentPolicy: matchedPolicy?.idPaymentPolicy ?? null,
    });

    setPolicyPanelOpen(true);
  }

  async function openCfdiPanel() {
    if (!canUse) return;

    setCfdiForm({
      cfdi: cfdi?.trim() || "",
    });

    setCfdiPanelOpen(true);
  }

  async function onSaveManager() {
    if (!canUse) {
      showToast("error", "Solicitud inválida.");
      return;
    }

    if (!managerForm.firstName.trim()) {
      showToast("error", "Captura el nombre.");
      return;
    }

    if (!managerForm.lastName.trim()) {
      showToast("error", "Captura el apellido paterno.");
      return;
    }

    setSavingManager(true);
    try {
      const payloadBase = {
        idAdministrativeUnit: managerForm.idAdministrativeUnit,
        firstName: managerForm.firstName.trim(),
        lastName: managerForm.lastName.trim(),
        secondLastName: managerForm.secondLastName.trim() || null,
        email: managerForm.email.trim() || null,
        phone: managerForm.phone.trim() || null,
      };

      let res: RequestResult;

      if (managerForm.idRequestManager) {
        res = (await requestJson(MANAGER_API, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            idRequestManager: managerForm.idRequestManager,
            ...payloadBase,
          }),
        })) as RequestResult;
      } else {
        res = (await requestJson(MANAGER_API, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            idRequest: requestId,
            requestNumber: requestNumber || String(requestId),
            ...payloadBase,
          }),
        })) as RequestResult;
      }

      if (!res.ok) {
        showToast("error", res.error || "No se pudo guardar el responsable.");
        return;
      }

      showToast(
        "success",
        managerForm.idRequestManager
          ? "Responsable actualizado."
          : "Responsable asignado.",
      );

      setManagerPanelOpen(false);
      await loadManager();
    } catch {
      showToast("error", "Error inesperado al guardar el responsable.");
    } finally {
      setSavingManager(false);
    }
  }

  async function onSavePolicy() {
    if (!canUse) {
      showToast("error", "Solicitud inválida.");
      return;
    }

    if (!policyForm.idPaymentPolicy) {
      showToast("error", "Selecciona una póliza.");
      return;
    }

    setSavingPolicy(true);

    try {
      const res = (await requestJson(
        `${REQUEST_DETAIL_API}/${requestId}/payment-policy`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(policyForm.idPaymentPolicy),
        },
      )) as RequestResult;

      if (!res.ok) {
        showToast("error", res.error || "No se pudo guardar la póliza.");
        return;
      }

      showToast("success", "Póliza asignada correctamente.");
      setPolicyPanelOpen(false);
      await loadRequestDetail();
    } catch {
      showToast("error", "Error inesperado al guardar la póliza.");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function onSaveCfdi() {
    if (!canUse) {
      showToast("error", "Solicitud inválida.");
      return;
    }

    if (!cfdiForm.cfdi.trim()) {
      showToast("error", "Captura el CFDI.");
      return;
    }

    setSavingCfdi(true);

    try {
      const res = (await requestJson(
        `${REQUEST_DETAIL_API}/${requestId}/CFDI`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(cfdiForm.cfdi.trim()),
        },
      )) as RequestResult;

      if (!res.ok) {
        showToast("error", res.error || "No se pudo guardar el CFDI.");
        return;
      }

      showToast("success", "CFDI guardado correctamente.");
      setCfdiPanelOpen(false);
      await loadRequestDetail();
    } catch {
      showToast("error", "Error inesperado al guardar el CFDI.");
    } finally {
      setSavingCfdi(false);
    }
  }

  async function onUploadMassive() {
    if (!canUse) {
      showToast("error", "RequestId inválido.");
      return;
    }

    if (uploads.length === 0) {
      showToast("error", "Agrega archivos antes de subir.");
      return;
    }

    const unassigned = uploads.filter((u) => !u.documentTypeId).length;
    if (unassigned > 0) {
      showToast(
        "error",
        `Faltan ${unassigned} archivo(s) por asignar a un tipo de documento.`,
      );
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("requestId", String(requestId));

      uploads.forEach((u) => {
        fd.append("files", u.file);
        fd.append("documentTypeId", String(u.documentTypeId ?? ""));
        fd.append("observations", u.observations ?? "");
      });

      const headers = authHeaders() as Record<string, string>;
      if ("Content-Type" in headers) delete headers["Content-Type"];

      const resp = await fetch(`${EXPEDIENT_API}/upload-massive`, {
        method: "POST",
        headers,
        body: fd,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Error HTTP ${resp.status}`);
      }

      showToast("success", "Carga realizada correctamente.");
      setUploads([]);
      setShowUploadPanel(false);

      if (fileInputRef.current) fileInputRef.current.value = "";

      await loadChecklist();
    } catch (e: unknown) {
      showToast(
        "error",
        e instanceof Error ? e.message : "Error inesperado al subir archivos.",
      );
    } finally {
      setUploading(false);
    }
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
  };

  return (
    <div className={`${styles.page} ${previewOpen ? styles.pageLocked : ""}`}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <div
        className={`${styles.mainContent} ${previewOpen ? styles.mainContentBlurred : ""}`}
      >
        <div className={styles.topActionsBar}>
          <button
            type="button"
            className={styles.btnBack}
            onClick={() => navigate(-1)}
            title="Regresar"
            aria-label="Regresar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Regresar</span>
          </button>

          <div className={styles.topActionsRight}>
            <div className={styles.searchCompactInline}>
              <input
                className={styles.input}
                placeholder="Buscar documento..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={!canUse}
              />

              {searchText.trim() !== "" && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setSearchText("")}
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className={styles.headerStatsInline}>
              <div className={styles.statsBoxOk}>
                <span className={styles.statsInlineLabel}>Cargados:</span>
                <span className={styles.statsHeaderValue}>
                  {stats.uploadedOk}
                </span>
              </div>

              <div className={styles.statsBoxBad}>
                <span className={styles.statsInlineLabel}>Faltan:</span>
                <span className={styles.statsHeaderValue}>
                  {stats.missingRequired}
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setShowUploadPanel(true)}
              disabled={!canUse || uploading}
            >
              Agregar archivos
            </button>
          </div>
        </div>

        <div className={styles.gridSingle}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>Checklist de documentos</div>

                <div className={styles.cardNoteInline}>
                  <div className={styles.inlineInfoGroup}>
                    <div className={styles.managerBox}>
                      <span className={styles.managerInlineLabel}>
                        Responsable:
                      </span>

                      <span
                        className={styles.managerHeaderName}
                        title={getManagerDisplayName(manager)}
                      >
                        {loadingManager
                          ? "Cargando..."
                          : getManagerDisplayName(manager)}
                      </span>

                      <button
                        type="button"
                        className={styles.managerActionBtn}
                        onClick={() => void openManagerPanel()}
                        disabled={!canUse || savingManager}
                      >
                        {manager ? "Editar responsable" : "Asignar responsable"}
                      </button>
                    </div>

                    <div className={styles.policyBox}>
                      <span className={styles.policyInlineLabel}>Póliza:</span>

                      <span
                        className={styles.policyHeaderName}
                        title={policyNumber?.trim() || "Sin póliza"}
                      >
                        {policyNumber?.trim() || "Sin póliza"}
                      </span>

                      <button
                        type="button"
                        className={styles.policyActionBtn}
                        onClick={() => void openPolicyPanel()}
                        disabled={!canUse || savingPolicy}
                      >
                        {policyNumber?.trim()
                          ? "Editar póliza"
                          : "Agregar póliza"}
                      </button>
                    </div>

                    <div className={styles.cfdiBox}>
                      <span className={styles.cfdiInlineLabel}>CFDI:</span>

                      <span
                        className={styles.cfdiHeaderName}
                        title={cfdi?.trim() || "Sin CFDI"}
                      >
                        {cfdi?.trim() || "Sin CFDI"}
                      </span>

                      <button
                        type="button"
                        className={styles.cfdiActionBtn}
                        onClick={() => void openCfdiPanel()}
                        disabled={!canUse || savingCfdi}
                      >
                        {cfdi?.trim() ? "Editar CFDI" : "Agregar CFDI"}
                      </button>
                    </div>

                    <button
                      type="button"
                      className={styles.headerEditChecklistBtn}
                      onClick={openChecklistPanel}
                      disabled={!canUse || savingChecklist}
                    >
                      Editar checklist
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              className={styles.hiddenFile}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Estado</th>
                    <th className={styles.thRight}>Archivo(s)</th>
                  </tr>
                </thead>

                <tbody>
                  {!canUse ? (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        No hay requestId válido en la URL.
                      </td>
                    </tr>
                  ) : loadingChecklist ? (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        Cargando checklist...
                      </td>
                    </tr>
                  ) : filteredChecklist.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        {checklist.length === 0
                          ? "Sin checklist para esta solicitud."
                          : `No se encontraron documentos con “${searchText.trim()}”.`}
                      </td>
                    </tr>
                  ) : (
                    filteredChecklist.map((c) => {
                      const isRequired = c.requiredByRule && !c.noApplies;
                      const hasFiles = c.files.length > 0;

                      const reviewStatusText = c.statusDescriptions.join(", ");

                      const stateClass = c.statusDescriptions.some((s) =>
                        s.toLowerCase().includes("deneg"),
                      )
                        ? styles.badgeBad
                        : c.statusDescriptions.some((s) =>
                              s.toLowerCase().includes("aprob"),
                            )
                          ? styles.badgeOk
                          : c.statusDescriptions.some((s) =>
                                s.toLowerCase().includes("pend"),
                              )
                            ? styles.badgeNeutral
                            : c.noApplies
                              ? styles.badgeNeutral
                              : styles.badgeNeutral;

                      const stateText = reviewStatusText || "Pendiente";

                      return (
                        <tr key={c.documentTypeId}>
                          <td className={styles.docCell}>
                            <div
                              className={`${styles.docCard} ${hasFiles ? styles.clickable : ""}`}
                              title={c.documentName}
                              role={hasFiles ? "button" : undefined}
                              tabIndex={hasFiles ? 0 : -1}
                              onClick={() =>
                                hasFiles
                                  ? openPreviewFromFiles(c, 0)
                                  : showToast(
                                      "error",
                                      "Este documento aún no tiene archivo.",
                                    )
                              }
                              onKeyDown={(e) => {
                                if (!hasFiles) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openPreviewFromFiles(c, 0);
                                }
                              }}
                            >
                              <div className={styles.docName}>
                                {c.documentName}
                              </div>

                              <div className={styles.docMeta}>
                                {isRequired && (
                                  <span className={styles.metaTagWarn}>
                                    Obligatorio
                                  </span>
                                )}
                                {c.noApplies && (
                                  <span className={styles.metaTag}>
                                    No aplica
                                  </span>
                                )}
                                {c.uploaded && (
                                  <span className={styles.metaTagOk}>
                                    Cargado
                                  </span>
                                )}
                                {!c.uploaded && !c.noApplies && !isRequired && (
                                  <span className={styles.metaTag}>
                                    Opcional
                                  </span>
                                )}
                                {hasFiles && (
                                  <span className={styles.metaTag}>
                                    {c.files.length} archivo
                                    {c.files.length === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`${styles.statusPill} ${stateClass}`}
                            >
                              {stateText}
                            </span>
                          </td>

                          <td className={styles.tdRight}>
                            {!hasFiles ? (
                              <span className={styles.fileEmpty}>
                                Sin archivo
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={styles.fileLink}
                                onClick={() => openPreviewFromFiles(c, 0)}
                                title={
                                  c.files.length === 1
                                    ? (c.files[0]?.name ??
                                      "Previsualizar archivo")
                                    : `Previsualizar ${c.files.length} archivos`
                                }
                              >
                                Ver archivo
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          showUploadPanel
            ? styles.uploadOverlayOpen
            : styles.uploadOverlayClosed
        }`}
        aria-hidden={!showUploadPanel}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>Carga de archivos</div>
              <div className={styles.uploadSheetNote}>
                Selecciona varios archivos y asigna cada uno al documento
                correspondiente
              </div>
            </div>

            <div className={styles.uploadSheetActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={onPickFiles}
                disabled={!canUse || uploading}
              >
                Seleccionar archivos
              </button>

              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  setUploads([]);
                  setShowUploadPanel(false);
                }}
                disabled={uploading}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className={styles.uploadSheetBody}>
            <div className={styles.dropzoneLarge} {...dropHandlers}>
              <div className={styles.dropTitle}>Arrastra archivos aquí</div>
              <div className={styles.dropSub}>
                o usa “Seleccionar archivos”.
              </div>
            </div>

            {uploads.length === 0 ? (
              <div className={styles.emptyUploadState}>
                Aún no has agregado archivos.
              </div>
            ) : (
              <div className={styles.uploadListFullscreen}>
                {uploads.map((u, idx) => (
                  <div
                    key={`${u.file.name}-${idx}`}
                    className={styles.uploadRow}
                  >
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName} title={u.file.name}>
                        {u.file.name}
                      </div>
                      <div className={styles.fileMeta}>
                        {bytesToHuman(u.file.size)}
                      </div>
                    </div>

                    <div className={styles.uploadControls}>
                      <div className={styles.editorFloatingSelectField}>
                        <span className={styles.editorFloatingLabel}>
                          Tipo de documento
                        </span>

                        <select
                          className={styles.editorFloatingSelect}
                          value={u.documentTypeId ?? ""}
                          onChange={(e) =>
                            onBindFromChecklist(
                              idx,
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                          disabled={uploading}
                        >
                          <option value="">Asignar tipo…</option>

                          {checklistOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.required && !o.uploaded
                                ? `🔴 ${o.name} (Obligatorio)`
                                : o.uploaded
                                  ? `🟢 ${o.name} ✓`
                                  : o.noApplies
                                    ? `⚪ ${o.name} (No aplica)`
                                    : `🟡 ${o.name}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.editorFloatingField}>
                        <span className={styles.editorFloatingLabel}>
                          Observaciones
                        </span>
                        <input
                          className={styles.editorFloatingInput}
                          value={u.observations}
                          onChange={(e) =>
                            setUploads((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, observations: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          disabled={uploading}
                          placeholder="Escribe una observación"
                        />
                      </div>

                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => onRemoveUpload(idx)}
                        disabled={uploading}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.uploadSheetFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setUploads([])}
              disabled={!canUse || uploading || uploads.length === 0}
            >
              Limpiar lista
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void onUploadMassive()}
              disabled={!canUse || uploads.length === 0 || uploading}
            >
              {uploading ? "Subiendo..." : "Subir todo"}
            </button>
          </div>
        </div>
      </div>
      <div
        className={`${styles.uploadOverlay} ${
          managerPanelOpen
            ? styles.uploadOverlayOpen
            : styles.uploadOverlayClosed
        }`}
        aria-hidden={!managerPanelOpen}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>
                {managerForm.idRequestManager
                  ? "Editar responsable"
                  : "Asignar responsable"}
              </div>
              <div className={styles.uploadSheetNote}>
                Captura o actualiza la información del responsable de la
                solicitud
              </div>
            </div>

            <div className={styles.uploadSheetActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeManagerPanel}
                disabled={savingManager}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className={styles.uploadSheetBody}>
            <div className={styles.managerFormWrap}>
              <div className={styles.managerSectionCard}>
                <div className={styles.editorSectionTitle}>
                  Área administrativa
                </div>

                <div className={styles.editorFloatingSelectField}>
                  <span className={styles.editorFloatingLabel}>Área</span>
                  <select
                    className={styles.editorFloatingSelect}
                    value={managerForm.idAdministrativeUnit ?? ""}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        idAdministrativeUnit: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    disabled={savingManager || loadingAdministrativeUnits}
                  >
                    <option value="">
                      {loadingAdministrativeUnits
                        ? "Cargando áreas..."
                        : "Seleccionar área administrativa…"}
                    </option>
                    {administrativeUnits.map((u) => (
                      <option
                        key={u.idAdministrativeUnit}
                        value={u.idAdministrativeUnit}
                      >
                        {u.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.managerSectionCard}>
                <div className={styles.editorSectionTitle}>
                  Datos del responsable
                </div>

                <div className={styles.formGridTwo}>
                  <div className={styles.editorFloatingField}>
                    <span className={styles.editorFloatingLabel}>
                      Nombre(s)
                    </span>
                    <input
                      className={styles.editorFloatingInput}
                      value={managerForm.firstName}
                      onChange={(e) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      disabled={savingManager}
                      placeholder="Captura el nombre"
                    />
                  </div>

                  <div className={styles.editorFloatingField}>
                    <span className={styles.editorFloatingLabel}>
                      Apellido paterno
                    </span>
                    <input
                      className={styles.editorFloatingInput}
                      value={managerForm.lastName}
                      onChange={(e) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      disabled={savingManager}
                      placeholder="Captura el apellido paterno"
                    />
                  </div>
                </div>

                <div className={styles.formGridOne}>
                  <div className={styles.editorFloatingField}>
                    <span className={styles.editorFloatingLabel}>
                      Apellido materno
                    </span>
                    <input
                      className={styles.editorFloatingInput}
                      value={managerForm.secondLastName}
                      onChange={(e) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          secondLastName: e.target.value,
                        }))
                      }
                      disabled={savingManager}
                      placeholder="Captura el apellido materno"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.managerSectionCard}>
                <div className={styles.editorSectionTitle}>Contacto</div>

                <div className={styles.formGridTwo}>
                  <div className={styles.editorFloatingField}>
                    <span className={styles.editorFloatingLabel}>
                      Correo electrónico
                    </span>
                    <input
                      className={styles.editorFloatingInput}
                      type="email"
                      value={managerForm.email}
                      onChange={(e) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      disabled={savingManager}
                      placeholder="usuario@correo.com"
                    />
                  </div>

                  <div className={styles.editorFloatingField}>
                    <span className={styles.editorFloatingLabel}>Teléfono</span>
                    <input
                      className={styles.editorFloatingInput}
                      value={managerForm.phone}
                      onChange={(e) =>
                        setManagerForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      disabled={savingManager}
                      placeholder="Captura el teléfono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.uploadSheetFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={closeManagerPanel}
              disabled={savingManager}
            >
              Cancelar
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void onSaveManager()}
              disabled={savingManager}
            >
              {savingManager ? "Guardando..." : "Guardar responsable"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          policyPanelOpen
            ? styles.uploadOverlayOpen
            : styles.uploadOverlayClosed
        }`}
        aria-hidden={!policyPanelOpen}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>
                {policyNumber?.trim() ? "Editar póliza" : "Agregar póliza"}
              </div>
              <div className={styles.uploadSheetNote}>
                Selecciona la póliza disponible que deseas asociar a esta
                solicitud
              </div>
            </div>

            <div className={styles.uploadSheetActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closePolicyPanel}
                disabled={savingPolicy}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className={styles.uploadSheetBody}>
            <div className={styles.policyFormWrap}>
              <div className={styles.managerSectionCard}>
                <div className={styles.editorSectionTitle}>
                  Datos de la póliza
                </div>

                <div className={styles.editorFloatingSelectField}>
                  <span className={styles.editorFloatingLabel}>Póliza</span>
                  <select
                    className={styles.editorFloatingSelect}
                    value={policyForm.idPaymentPolicy ?? ""}
                    onChange={(e) =>
                      setPolicyForm({
                        idPaymentPolicy: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    disabled={savingPolicy || loadingPolicies}
                  >
                    <option value="">
                      {loadingPolicies
                        ? "Cargando pólizas..."
                        : "Seleccionar póliza…"}
                    </option>

                    {paymentPolicies.map((p) => (
                      <option key={p.idPaymentPolicy} value={p.idPaymentPolicy}>
                        {p.policyCode}
                        {p.description ? ` — ${p.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {policyForm.idPaymentPolicy && (
                  <div className={styles.policyPreviewCard}>
                    <div className={styles.policyPreviewCode}>
                      {paymentPolicies.find(
                        (x) => x.idPaymentPolicy === policyForm.idPaymentPolicy,
                      )?.policyCode ?? "Póliza seleccionada"}
                    </div>

                    <div className={styles.policyPreviewDesc}>
                      {paymentPolicies.find(
                        (x) => x.idPaymentPolicy === policyForm.idPaymentPolicy,
                      )?.description || "Sin descripción adicional."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.uploadSheetFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={closePolicyPanel}
              disabled={savingPolicy}
            >
              Cancelar
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void onSavePolicy()}
              disabled={savingPolicy}
            >
              {savingPolicy ? "Guardando..." : "Guardar póliza"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          cfdiPanelOpen ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
        }`}
        aria-hidden={!cfdiPanelOpen}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>
                {cfdi?.trim() ? "Editar CFDI" : "Agregar CFDI"}
              </div>
              <div className={styles.uploadSheetNote}>
                Captura el folio o valor del CFDI para asociarlo a esta
                solicitud
              </div>
            </div>

            <div className={styles.uploadSheetActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeCfdiPanel}
                disabled={savingCfdi}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className={styles.uploadSheetBody}>
            <div className={styles.policyFormWrap}>
              <div className={styles.managerSectionCard}>
                <div className={styles.editorSectionTitle}>Datos del CFDI</div>

                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>CFDI</span>
                  <input
                    className={styles.editorFloatingInput}
                    value={cfdiForm.cfdi}
                    onChange={(e) =>
                      setCfdiForm({
                        cfdi: e.target.value,
                      })
                    }
                    placeholder="Captura el CFDI…"
                    disabled={savingCfdi}
                  />
                </div>

                {cfdiForm.cfdi.trim() && (
                  <div className={styles.cfdiPreviewCard}>
                    <div className={styles.cfdiPreviewCode}>
                      {cfdiForm.cfdi.trim()}
                    </div>
                    <div className={styles.cfdiPreviewDesc}>
                      CFDI que se asociará a esta solicitud.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.uploadSheetFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={closeCfdiPanel}
              disabled={savingCfdi}
            >
              Cancelar
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void onSaveCfdi()}
              disabled={savingCfdi}
            >
              {savingCfdi ? "Guardando..." : "Guardar CFDI"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          checklistPanelOpen
            ? styles.uploadOverlayOpen
            : styles.uploadOverlayClosed
        }`}
        aria-hidden={!checklistPanelOpen}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>Editar checklist</div>
              <div className={styles.uploadSheetNote}>
                Define claramente si cada documento es obligatorio o no aplica
              </div>
            </div>

            <div className={styles.uploadSheetActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeChecklistPanel}
                disabled={savingChecklist}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className={styles.uploadSheetBody}>
            {checklistExceptionRows.length === 0 ? (
              <div className={styles.emptyUploadState}>
                No hay documentos obligatorios para editar.
              </div>
            ) : (
              <div className={styles.checklistCompactWrap}>
                <div className={styles.checklistCompactHeader}>
                  <div className={styles.checklistCompactHeaderDoc}>
                    Documento
                  </div>
                  <div className={styles.checklistCompactHeaderState}>
                    Estado
                  </div>
                </div>

                <div className={styles.checklistCompactList}>
                  {checklistExceptionRows.map((row) => {
                    const isRequired = !row.doesNotApply;

                    return (
                      <div
                        key={row.documentTypeId}
                        className={`${styles.checklistCompactCard} ${
                          row.uploaded
                            ? styles.checklistStateUploaded
                            : row.doesNotApply
                              ? styles.checklistStateNoApply
                              : styles.checklistStateRequired
                        }`}
                      >
                        <div className={styles.checklistCompactTop}>
                          <div className={styles.checklistCompactDocBlock}>
                            <div className={styles.checklistCompactDocName}>
                              {row.documentName}
                            </div>

                            <div className={styles.checklistCompactBadges}>
                              {row.uploaded && (
                                <span
                                  className={styles.checklistCompactBadgeOk}
                                >
                                  Completo
                                </span>
                              )}

                              <span
                                className={
                                  row.doesNotApply
                                    ? styles.checklistCompactBadgeNeutral
                                    : styles.checklistCompactBadgeWarn
                                }
                              >
                                {row.doesNotApply ? "No aplica" : "Obligatorio"}
                              </span>
                            </div>
                          </div>

                          <div className={styles.checklistCompactStateBlock}>
                            <label className={styles.checklistCompactOption}>
                              <span
                                className={styles.checklistCompactOptionLabel}
                              >
                                No aplica
                              </span>
                              <input
                                type="radio"
                                name={`checklist-state-${row.documentTypeId}`}
                                checked={row.doesNotApply}
                                onChange={() =>
                                  setChecklistExceptionRows((prev) =>
                                    prev.map((item) =>
                                      item.documentTypeId === row.documentTypeId
                                        ? {
                                            ...item,
                                            doesNotApply: true,
                                            justification:
                                              item.justification.trim() ||
                                              "No aplica",
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                disabled={savingChecklist}
                              />
                            </label>

                            <label className={styles.checklistCompactOption}>
                              <span
                                className={styles.checklistCompactOptionLabel}
                              >
                                Obligatorio
                              </span>
                              <input
                                type="radio"
                                name={`checklist-state-${row.documentTypeId}`}
                                checked={isRequired}
                                onChange={() =>
                                  setChecklistExceptionRows((prev) =>
                                    prev.map((item) =>
                                      item.documentTypeId === row.documentTypeId
                                        ? {
                                            ...item,
                                            doesNotApply: false,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                disabled={savingChecklist}
                              />
                            </label>
                          </div>
                        </div>

                        <div className={styles.checklistCompactBottom}>
                          <label className={styles.fieldLabel}>
                            Justificación
                          </label>
                          <textarea
                            className={styles.checklistCompactTextarea}
                            value={
                              row.doesNotApply ? row.justification : "Aplica"
                            }
                            onChange={(e) =>
                              setChecklistExceptionRows((prev) =>
                                prev.map((item) =>
                                  item.documentTypeId === row.documentTypeId
                                    ? { ...item, justification: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            disabled={savingChecklist || !row.doesNotApply}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={styles.uploadSheetFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={closeChecklistPanel}
              disabled={savingChecklist}
            >
              Cancelar
            </button>

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void onSaveChecklistExceptions()}
              disabled={savingChecklist}
            >
              {savingChecklist ? "Guardando..." : "Guardar checklist"}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && currentPreview && (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Previsualización de archivo"
          onClick={() => {
            if (deleteModalOpen) return;
            closePreview();
          }}
        >
          <div
            className={styles.previewModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div className={styles.previewHeaderInfo}>
                <div className={styles.previewTitle}>Previsualización</div>
                <div className={styles.previewName} title={currentPreview.name}>
                  {currentPreview.name}
                </div>
              </div>

              <div className={styles.previewActions}>
                {isImagePreview && canMovePreview && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => setAutoPlay((v) => !v)}
                    disabled={reviewingDocument}
                  >
                    {autoPlay ? "Pausar" : "Reproducir"}
                  </button>
                )}

                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUrl(currentPreview.url)}
                  disabled={reviewingDocument}
                >
                  Abrir aparte
                </button>

                {currentPreview.id && (
                  <button
                    id="btn-aprobar-documento"
                    type="button"
                    className={styles.saveBtn}
                    onClick={() =>
                      void onReviewPreviewDocument(
                        currentPreview,
                        DOCUMENT_STATUS_APPROVED,
                      )
                    }
                    disabled={reviewingDocument || deletingPreview}
                    title="Dar visto bueno al documento"
                  >
                    {reviewingDocument ? "Procesando..." : "Aprobar documento"}
                  </button>
                )}

                {currentPreview.id && (
                  <button
                    id="btn-denegar-documento"
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setShowRejectBox((prev) => !prev)}
                    disabled={reviewingDocument || deletingPreview}
                    title="Denegar documento"
                  >
                    Denegar documento
                  </button>
                )}

                {currentPreview.id && (
                  <button
                    type="button"
                    className={styles.iconDangerBtn}
                    onClick={() => openDeleteModal(currentPreview)}
                    disabled={deletingPreview || reviewingDocument}
                    title="Eliminar documento"
                    aria-label="Eliminar documento"
                  >
                    <svg
                      width="18"
                      height="18"
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
                    <span>Eliminar</span>
                  </button>
                )}

                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={closePreview}
                  disabled={reviewingDocument}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
              <div
                className={
                  hasPreviewInfo
                    ? styles.previewBodySplit
                    : styles.previewBodySingle
                }
              >
                <div className={styles.previewViewerPane}>
                  {isImagePreview && (
                    <div className={styles.previewCarouselWrap}>
                      <div className={styles.previewImageStage}>
                        <img
                          src={currentPreview.url}
                          alt={currentPreview.name}
                          className={styles.previewImage}
                        />

                        {canMovePreview && (
                          <>
                            <button
                              type="button"
                              className={`${styles.carouselNav} ${styles.carouselPrev}`}
                              onClick={() => {
                                setAutoPlay(false);
                                goPrevPreview();
                              }}
                              aria-label="Archivo anterior"
                            >
                              ‹
                            </button>

                            <button
                              type="button"
                              className={`${styles.carouselNav} ${styles.carouselNext}`}
                              onClick={() => {
                                setAutoPlay(false);
                                goNextPreview();
                              }}
                              aria-label="Archivo siguiente"
                            >
                              ›
                            </button>
                          </>
                        )}

                        {canMovePreview && (
                          <div className={styles.carouselCounter}>
                            {previewIndex + 1} / {previewItems.length}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isPdfPreview && (
                    <div className={styles.previewPdfWrap}>
                      <div className={styles.previewPdfStage}>
                        {canMovePreview && (
                          <>
                            <button
                              type="button"
                              className={`${styles.carouselNav} ${styles.carouselPrev}`}
                              onClick={() => {
                                setAutoPlay(false);
                                goPrevPreview();
                              }}
                              aria-label="Archivo anterior"
                            >
                              ‹
                            </button>

                            <button
                              type="button"
                              className={`${styles.carouselNav} ${styles.carouselNext}`}
                              onClick={() => {
                                setAutoPlay(false);
                                goNextPreview();
                              }}
                              aria-label="Archivo siguiente"
                            >
                              ›
                            </button>
                          </>
                        )}

                        {canMovePreview && (
                          <div className={styles.carouselCounter}>
                            {previewIndex + 1} / {previewItems.length}
                          </div>
                        )}

                        <iframe
                          src={`${currentPreview.url}#view=FitH`}
                          title={currentPreview.name}
                          className={styles.previewFrame}
                        />
                      </div>
                    </div>
                  )}

                  {!isImagePreview && !isPdfPreview && (
                    <div className={styles.previewFallback}>
                      <div className={styles.previewFallbackTitle}>
                        No se puede previsualizar este tipo de archivo aquí.
                      </div>
                      <div className={styles.previewFallbackText}>
                        Puedes abrirlo en otra pestaña para verlo completo.
                      </div>

                      {canMovePreview && (
                        <div className={styles.previewFallbackNav}>
                          <button
                            type="button"
                            className={styles.carouselNavInline}
                            onClick={() => {
                              setAutoPlay(false);
                              goPrevPreview();
                            }}
                            aria-label="Archivo anterior"
                          >
                            Anterior
                          </button>

                          <button
                            type="button"
                            className={styles.carouselNavInline}
                            onClick={() => {
                              setAutoPlay(false);
                              goNextPreview();
                            }}
                            aria-label="Archivo siguiente"
                          >
                            Siguiente
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => openUrl(currentPreview.url)}
                      >
                        Abrir archivo
                      </button>
                    </div>
                  )}

                  {previewItems.length > 1 && (
                    <div className={styles.previewThumbs}>
                      {previewItems.map((item, idx) => (
                        <div
                          key={`${item.id ?? "thumb"}-${item.url}-${idx}`}
                          className={`${styles.previewThumbCard} ${
                            idx === previewIndex
                              ? styles.previewThumbCardActive
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={styles.previewThumbBtn}
                            onClick={() => {
                              setAutoPlay(false);
                              setPreviewIndex(idx);
                            }}
                            title={item.name}
                          >
                            {item.type === "image" ? (
                              <img
                                src={item.url}
                                alt={item.name}
                                className={styles.previewThumbImg}
                              />
                            ) : (
                              <div className={styles.previewThumbFile}>
                                <div className={styles.previewThumbFileIcon}>
                                  {item.type === "pdf" ? "PDF" : "DOC"}
                                </div>
                                <div
                                  className={styles.previewThumbFileName}
                                  title={item.name}
                                >
                                  {item.name}
                                </div>
                              </div>
                            )}
                          </button>

                          {item.id && (
                            <button
                              type="button"
                              className={styles.previewThumbDelete}
                              onClick={() => openDeleteModal(item)}
                              title={`Eliminar ${item.name}`}
                              aria-label={`Eliminar ${item.name}`}
                              disabled={deletingPreview}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {hasPreviewInfo && (
                  <aside className={styles.previewObservationPane}>
                    <div className={styles.previewInfoBlock}>
                      <div className={styles.previewInfoLabel}>Estado</div>
                      <div>
                        <span
                          className={`${styles.statusPill} ${
                            (currentPreview?.reviewStatus || "")
                              .toLowerCase()
                              .includes("deneg")
                              ? styles.badgeBad
                              : (currentPreview?.reviewStatus || "")
                                    .toLowerCase()
                                    .includes("aprob")
                                ? styles.badgeOk
                                : styles.badgeNeutral
                          }`}
                        >
                          {currentPreview?.reviewStatus || "Pendiente"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.previewInfoBlock}>
                      <div className={styles.previewInfoLabel}>
                        Nombre del documento
                      </div>
                      <div className={styles.previewMetaCard}>
                        <div
                          className={styles.previewMetaValue}
                          title={currentPreview?.name}
                        >
                          {currentPreview?.name || "Sin nombre"}
                        </div>
                      </div>
                    </div>

                    <div className={styles.previewInfoBlock}>
                      <div className={styles.previewInfoLabel}>
                        Tipo de archivo
                      </div>
                      <div className={styles.previewMetaCard}>
                        <div className={styles.previewMetaValue}>
                          {currentPreview?.type === "image"
                            ? "Imagen"
                            : currentPreview?.type === "pdf"
                              ? "Documento PDF"
                              : "Archivo"}
                        </div>
                      </div>
                    </div>

                    <div className={styles.previewInfoBlock}>
                      <div className={styles.previewInfoLabel}>
                        Observaciones
                      </div>

                      <div className={styles.previewObservationCard}>
                        {hasReviewObservation ? (
                          <div>
                            <strong>Observación:</strong>{" "}
                            {currentPreview?.reviewObservation}
                          </div>
                        ) : (
                          <div className={styles.previewObservationEmpty}>
                            Este documento no tiene observaciones registradas.
                          </div>
                        )}
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewOpen && showRejectBox && currentPreview && currentPreview.id && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar denegación del documento"
          onClick={() => {
            if (reviewingDocument) return;
            setShowRejectBox(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 3000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 96vw)",
              background: "#ffffff",
              borderRadius: "18px",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
              border: "1px solid rgba(239, 68, 68, 0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #fee2e2",
                background: "#fff7f7",
              }}
            >
              <div
                style={{ fontSize: "18px", fontWeight: 800, color: "#991b1b" }}
              >
                Denegar documento
              </div>
              <div
                style={{ marginTop: "6px", color: "#7f1d1d", fontSize: "14px" }}
              >
                Confirma la denegación e indica las observaciones del documento.
              </div>
            </div>

            <div style={{ padding: "20px", display: "grid", gap: "14px" }}>
              <div
                style={{
                  display: "grid",
                  gap: "8px",
                  padding: "14px",
                  borderRadius: "14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    fontWeight: 700,
                  }}
                >
                  Documento
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    color: "#0f172a",
                    fontWeight: 700,
                  }}
                >
                  {currentPreview.name}
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Estado</label>
                <input
                  type="text"
                  className={styles.input}
                  value="Denegado"
                  disabled
                  readOnly
                />
              </div>

              <div className={styles.formField}>
                <label
                  htmlFor="txt-observaciones-denegacion-documento"
                  className={styles.fieldLabel}
                >
                  Observaciones
                </label>
                <textarea
                  id="txt-observaciones-denegacion-documento"
                  className={styles.checklistCompactTextarea}
                  value={rejectObservations}
                  onChange={(e) => setRejectObservations(e.target.value)}
                  placeholder="Escribe la razón por la cual se deniega el documento"
                  rows={6}
                  disabled={reviewingDocument}
                  autoFocus
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "16px 20px 20px",
                borderTop: "1px solid #f1f5f9",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  setShowRejectBox(false);
                  setRejectObservations("");
                }}
                disabled={reviewingDocument}
              >
                Cancelar
              </button>

              <button
                id="btn-confirmar-denegacion-documento"
                type="button"
                className={styles.dangerBtn}
                onClick={() =>
                  void onReviewPreviewDocument(
                    currentPreview,
                    DOCUMENT_STATUS_REJECTED,
                    rejectObservations,
                  )
                }
                disabled={reviewingDocument || !rejectObservations.trim()}
              >
                {reviewingDocument ? "Procesando..." : "Confirmar denegación"}
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
                  Esta acción eliminará el documento seleccionado.
                </div>
              </div>
            </div>

            <div className={styles.deleteConfirmBody}>
              <div className={styles.deleteFileCard}>
                <div className={styles.deleteFileLabel}>Documento</div>
                <div
                  className={styles.deleteFileName}
                  title={deleteTarget.name}
                >
                  {deleteTarget.name}
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Contraseña</label>
                <input
                  type="password"
                  className={styles.input}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  disabled={deletingPreview}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !deletingPreview) {
                      void onDeletePreviewDocumentByItem(
                        deleteTarget,
                        deletePassword,
                      );
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
                disabled={deletingPreview}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.deleteConfirmBtn}
                onClick={() =>
                  void onDeletePreviewDocumentByItem(
                    deleteTarget,
                    deletePassword,
                  )
                }
                disabled={deletingPreview || !deletePassword.trim()}
              >
                {deletingPreview ? "Eliminando..." : "Eliminar documento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
