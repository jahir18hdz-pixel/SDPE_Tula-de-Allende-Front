import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  observations?: string | null;
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

type PreviewItem = {
  id: number | null;
  url: string;
  name: string;
  type: "image" | "pdf" | "other";
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
      payload["Result"]
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

function getExtensionFromSource(source: string) {
  const clean = source.split("?")[0].split("#")[0].trim().toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
}

function getPreviewType(url: string, fileName?: string | null): "image" | "pdf" | "other" {
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
          raw["IdDocumentType"]
      );

      const documentName = toStringSafe(
        raw["documentName"] ??
          raw["DocumentName"] ??
          raw["documentTypeName"] ??
          raw["DocumentTypeName"]
      ).trim();

      if (!documentTypeId || !documentName) return null;

      const requiredByRule = toBool(
        raw["requiredByRule"] ??
          raw["RequiredByRule"] ??
          raw["isRequired"] ??
          raw["IsRequired"] ??
          raw["obligatorio"] ??
          raw["Obligatorio"]
      );

      const noApplies = toBool(
        raw["noApplies"] ??
          raw["NoApplies"] ??
          raw["noAplica"] ??
          raw["NoAplica"] ??
          raw["doesNotApply"] ??
          raw["DoesNotApply"]
      );

      const uploaded = toBool(
        raw["uploaded"] ??
          raw["Uploaded"] ??
          raw["hasFile"] ??
          raw["HasFile"] ??
          raw["active"] ??
          raw["Active"]
      );

      const observations =
        toStringSafe(raw["observations"] ?? raw["Observations"]).trim() || null;

      const fileIdsRaw = asArray(raw["fileIds"] ?? raw["FileIds"]);
      const fileNames = toStringArray(raw["fileNames"] ?? raw["FileNames"]);
      const fileUrls = toStringArray(raw["fileUrls"] ?? raw["FileUrls"]);
      const previewUrls = toStringArray(raw["previewUrls"] ?? raw["PreviewUrls"]);

      const maxLen = Math.max(
        fileIdsRaw.length,
        fileNames.length,
        fileUrls.length,
        previewUrls.length
      );

      const files: ChecklistFileItem[] = Array.from({ length: maxLen }, (_, i) => {
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
      }).filter((x) => x.url || x.previewUrl);

      return {
        documentTypeId,
        documentName,
        requiredByRule,
        noApplies,
        uploaded,
        observations,
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

export default function ExpedientDocuments() {
  const navigate = useNavigate();
  const params = useParams();

  const requestId = useMemo(() => {
    const raw = (params.id ?? params.requestId ?? params.requestID ?? "") as string;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [params]);

  const canUse = requestId > 0;

  const [requestNumber, setRequestNumber] = useState<string>("");

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

  const [managerPanelOpen, setManagerPanelOpen] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [loadingAdministrativeUnits, setLoadingAdministrativeUnits] = useState(false);
  const [administrativeUnits, setAdministrativeUnits] = useState<AdministrativeUnitOption[]>([]);
  const [managerForm, setManagerForm] = useState<ManagerFormState>({
    idRequestManager: null,
    idAdministrativeUnit: null,
    firstName: "",
    lastName: "",
    secondLastName: "",
    email: "",
    phone: "",
  });

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
    [showToast]
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewItems([]);
    setPreviewIndex(0);
    setAutoPlay(true);
  }, []);

  const closeManagerPanel = useCallback(() => {
    setManagerPanelOpen(false);
  }, []);

  const loadRequestDetail = useCallback(async () => {
    if (!canUse) return;

    try {
      const res = (await requestJson(`${REQUEST_DETAIL_API}/${requestId}`, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

      if (!res.ok) {
        setRequestNumber("");
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
                data["Folio"]
            )
          : ""
        ).trim() || "";

      setRequestNumber(rn);
    } catch {
      setRequestNumber("");
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
          const rn = toStringSafe(x["requestNumber"] ?? x["RequestNumber"]).trim();
          return rn === String(requestId);
        }) as UnknownRecord) ?? null;

      if (!found && requestNumber) {
        found =
          (list.find((x) => {
            if (!isRecord(x)) return false;
            const rn = toStringSafe(x["requestNumber"] ?? x["RequestNumber"]).trim();
            return rn === requestNumber;
          }) as UnknownRecord) ?? null;
      }

      if (!found) {
        setManager(null);
        return;
      }

      const idRequestManager = toNumber(found["idRequestManager"] ?? found["IdRequestManager"]);
      const fullName = toStringSafe(found["fullName"] ?? found["FullName"]).trim();
      const administrativeUnit =
        toStringSafe(found["administrativeUnit"] ?? found["AdministrativeUnit"]).trim() || null;
      const reqNum =
        toStringSafe(found["requestNumber"] ?? found["RequestNumber"]).trim() || null;

      if (!idRequestManager || !fullName) {
        setManager(null);
        return;
      }

      setManager({
        idRequestManager,
        fullName,
        requestNumber: reqNum,
        administrativeUnit,
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
      const res = (await requestJson(`${EXPEDIENT_API}/requests/${requestId}/checklist`, {
        method: "GET",
        headers: authHeaders(),
      })) as RequestResult;

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
        if (aRequiredApplies !== bRequiredApplies) return aRequiredApplies ? -1 : 1;

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
    const required = checklist.filter((x) => x.requiredByRule && !x.noApplies).length;
    const uploadedOk = checklist.filter((x) => x.uploaded).length;
    const requiredUploaded = checklist.filter(
      (x) => x.requiredByRule && !x.noApplies && x.uploaded
    ).length;
    const missingRequired = Math.max(0, required - requiredUploaded);
    return { required, uploadedOk, requiredUploaded, missingRequired };
  }, [checklist]);

  const missingRequiredList = useMemo(
    () => checklist.filter((x) => x.requiredByRule && !x.noApplies && !x.uploaded),
    [checklist]
  );

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

  const openPreviewFromFiles = useCallback(
    (documentName: string, files: ChecklistFileItem[], selectedIndex = 0) => {
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
          };
        })
        .filter((x) => x.url);

      if (!mapped.length) {
        showToast("error", "No hay archivo para previsualizar.");
        return;
      }

      const safeIndex =
        selectedIndex >= 0 && selectedIndex < mapped.length ? selectedIndex : 0;

      const selected = mapped[safeIndex];
      const selectedType = selected?.type ?? mapped[0].type;

      if (selectedType === "image") {
        const onlyImages = mapped.filter((x) => x.type === "image");
        const imageIndex = onlyImages.findIndex((x) => x.url === selected?.url);

        setPreviewItems(onlyImages.length ? onlyImages : mapped);
        setPreviewIndex(imageIndex >= 0 ? imageIndex : 0);
        setAutoPlay(onlyImages.length > 1);
      } else {
        setPreviewItems([selected ?? mapped[0]]);
        setPreviewIndex(0);
        setAutoPlay(false);
      }

      setPreviewOpen(true);
    },
    [showToast]
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
    async (item: PreviewItem) => {
      if (!item.id) {
        showToast("error", "No se puede eliminar este archivo porque no tiene identificador.");
        return;
      }

      const confirmed = window.confirm(
        `¿Seguro que deseas eliminar el archivo "${item.name}"?`
      );

      if (!confirmed) return;

      const password = window.prompt("Ingresa tu contraseña para confirmar la eliminación:");
      if (!password || !password.trim()) {
        showToast("error", "Debes capturar la contraseña para eliminar el archivo.");
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
            const safePrev = removedIndex >= 0 ? Math.min(prev, removedIndex) : prev;
            return Math.max(0, Math.min(safePrev, nextItems.length - 1));
          });
        }

        await loadChecklist();
      } catch {
        showToast("error", "Error inesperado al eliminar el documento.");
      } finally {
        setDeletingPreview(false);
      }
    },
    [previewItems, closePreview, loadChecklist, showToast]
  );

  const onDeleteCurrentPreview = useCallback(async () => {
    if (!currentPreview) return;
    await onDeletePreviewDocumentByItem(currentPreview);
  }, [currentPreview, onDeletePreviewDocumentByItem]);

  useEffect(() => {
    if (!previewOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowLeft" && canMovePreview) goPrevPreview();
      if (e.key === "ArrowRight" && canMovePreview) goNextPreview();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen, closePreview, canMovePreview, goPrevPreview, goNextPreview]);

  useEffect(() => {
    if (!previewOpen || !autoPlay || !isImagePreview || previewItems.length <= 1) return;

    const timer = window.setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % previewItems.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [previewOpen, autoPlay, isImagePreview, previewItems.length]);

  const canUpload = canUse && uploads.length > 0 && !uploading;

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    setUploads((prev) => [
      ...prev,
      ...arr.map((f) => ({
        file: f,
        documentTypeId: null,
        observations: "",
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

  function onBindFromChecklist(uploadIdx: number, docTypeId: number) {
    setUploads((prev) =>
      prev.map((u, i) => (i === uploadIdx ? { ...u, documentTypeId: docTypeId } : u))
    );
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
                  raw["Id"]
              );

              const description = toStringSafe(
                raw["description"] ??
                  raw["Description"] ??
                  raw["descripcion"] ??
                  raw["Descripcion"]
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
            (manager.administrativeUnit ?? "").trim().toLowerCase()
        ) ?? null;

      setManagerForm({
        idRequestManager: manager.idRequestManager,
        idAdministrativeUnit: matchedUnit?.idAdministrativeUnit ?? null,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        secondLastName: nameParts.secondLastName,
        email: "",
        phone: "",
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
        managerForm.idRequestManager ? "Responsable actualizado." : "Responsable asignado."
      );

      setManagerPanelOpen(false);
      await loadManager();
    } catch {
      showToast("error", "Error inesperado al guardar el responsable.");
    } finally {
      setSavingManager(false);
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
      showToast("error", `Faltan ${unassigned} archivo(s) por asignar a un tipo de documento.`);
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
      showToast("error", e instanceof Error ? e.message : "Error inesperado al subir archivos.");
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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
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

      <div className={`${styles.mainContent} ${previewOpen ? styles.mainContentBlurred : ""}`}>
        <div className={styles.topActionsBar}>
          <button
  type="button"
  className={styles.btnBack}
  onClick={() => navigate(-1)}
  title="Regresar"
  aria-label="Regresar"
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                <button type="button" className={styles.ghostBtn} onClick={() => setSearchText("")}>
                  Limpiar
                </button>
              )}
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
  <div className={styles.managerBox}>
    <span className={styles.managerInlineLabel}>Responsable:</span>

    <span className={styles.managerHeaderName} title={getManagerDisplayName(manager)}>
      {loadingManager ? "Cargando..." : getManagerDisplayName(manager)}
    </span>

    {manager?.administrativeUnit && (
      <span className={styles.metaTag}>{manager.administrativeUnit}</span>
    )}

    <button
      type="button"
      className={styles.managerActionBtn}
      onClick={() => void openManagerPanel()}
      disabled={!canUse || savingManager}
    >
      {manager ? "Editar responsable" : "Asignar responsable"}
    </button>
  </div>
</div>
              </div>

              <div className={styles.headerStatsMini}>
                <span className={`${styles.miniStat} ${styles.miniWarn}`}>
                  Obligatorios: <b>{stats.required}</b>
                </span>
                <span className={`${styles.miniStat} ${styles.miniOk}`}>
                  Cargados: <b>{stats.uploadedOk}</b>
                </span>
                <span className={`${styles.miniStat} ${styles.miniBad}`}>
                  Faltan: <b>{stats.missingRequired}</b>
                </span>
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
                      <td colSpan={3} className={styles.empty}>
                        No hay requestId válido en la URL.
                      </td>
                    </tr>
                  ) : loadingChecklist ? (
                    <tr>
                      <td colSpan={3} className={styles.empty}>
                        Cargando checklist...
                      </td>
                    </tr>
                  ) : filteredChecklist.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.empty}>
                        {checklist.length === 0
                          ? "Sin checklist para esta solicitud."
                          : `No se encontraron documentos con “${searchText.trim()}”.`}
                      </td>
                    </tr>
                  ) : (
                    filteredChecklist.map((c) => {
                      const isRequired = c.requiredByRule && !c.noApplies;
                      const hasFiles = c.files.length > 0;

                      const stateClass = c.noApplies
                        ? styles.badgeNeutral
                        : c.uploaded
                          ? styles.badgeOk
                          : isRequired
                            ? styles.badgeBad
                            : styles.badgeNeutral;

                      const stateText = c.noApplies
                        ? "No aplica"
                        : c.uploaded
                          ? "Completo"
                          : isRequired
                            ? "Pendiente"
                            : "Opcional";

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
                                  ? openPreviewFromFiles(c.documentName, c.files, 0)
                                  : showToast("error", "Este documento aún no tiene archivo.")
                              }
                              onKeyDown={(e) => {
                                if (!hasFiles) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openPreviewFromFiles(c.documentName, c.files, 0);
                                }
                              }}
                            >
                              <div className={styles.docName}>{c.documentName}</div>

                              <div className={styles.docMeta}>
                                {isRequired && <span className={styles.metaTagWarn}>Obligatorio</span>}
                                {c.noApplies && <span className={styles.metaTag}>No aplica</span>}
                                {c.uploaded && <span className={styles.metaTagOk}>Cargado</span>}
                                {!c.uploaded && !c.noApplies && !isRequired && (
                                  <span className={styles.metaTag}>Opcional</span>
                                )}
                                {hasFiles && (
                                  <span className={styles.metaTag}>
                                    {c.files.length} archivo{c.files.length === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>

                              {c.observations && (
                                <div className={styles.cardNote}>Obs: {c.observations}</div>
                              )}
                            </div>
                          </td>

                          <td>
                            <span className={`${styles.statusPill} ${stateClass}`}>{stateText}</span>
                          </td>

                          <td className={styles.tdRight}>
                            {!hasFiles ? (
                              <span className={styles.fileEmpty}>Sin archivo</span>
                            ) : c.files.length === 1 ? (
                              <button
                                type="button"
                                className={styles.fileLink}
                                onClick={() => openPreviewFromFiles(c.documentName, c.files, 0)}
                                title={c.files[0]?.name ?? "Previsualizar archivo"}
                              >
                                Ver archivo
                              </button>
                            ) : (
                              <div className={styles.fileActionsList}>
                                {c.files.map((file, index) => (
                                  <button
                                    key={`${file.id ?? "file"}-${file.name}-${index}`}
                                    type="button"
                                    className={styles.fileLink}
                                    onClick={() => openPreviewFromFiles(c.documentName, c.files, index)}
                                    title={file.name}
                                  >
                                    Ver {index + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {missingRequiredList.length > 0 && (
              <div className={styles.footerHint}>
                <b>Faltan obligatorios:</b>{" "}
                {missingRequiredList.slice(0, 4).map((x) => x.documentName).join(", ")}
                {missingRequiredList.length > 4 ? "…" : ""}
              </div>
            )}
          </section>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          showUploadPanel ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
        }`}
        aria-hidden={!showUploadPanel}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>Carga de archivos</div>
              <div className={styles.uploadSheetNote}>
                Selecciona varios archivos y asigna cada uno al documento correspondiente
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
              <div className={styles.dropSub}>o usa “Seleccionar archivos”.</div>
            </div>

            {uploads.length === 0 ? (
              <div className={styles.emptyUploadState}>Aún no has agregado archivos.</div>
            ) : (
              <div className={styles.uploadListFullscreen}>
                {uploads.map((u, idx) => (
                  <div key={`${u.file.name}-${idx}`} className={styles.uploadRow}>
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName} title={u.file.name}>
                        {u.file.name}
                      </div>
                      <div className={styles.fileMeta}>{bytesToHuman(u.file.size)}</div>
                    </div>

                    <div className={styles.uploadControls}>
                      <select
                        className={styles.select}
                        value={u.documentTypeId ?? ""}
                        onChange={(e) => onBindFromChecklist(idx, Number(e.target.value))}
                        disabled={uploading}
                      >
                        <option value="">Asignar tipo…</option>
                        {checklistOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.noApplies ? " (No aplica)" : o.required ? " (Obligatorio)" : ""}
                            {o.uploaded ? " ✓" : ""}
                          </option>
                        ))}
                      </select>

                      <input
                        className={styles.input}
                        placeholder="Observaciones"
                        value={u.observations}
                        onChange={(e) =>
                          setUploads((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, observations: e.target.value } : x
                            )
                          )
                        }
                        disabled={uploading}
                      />

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
              disabled={!canUpload}
            >
              {uploading ? "Subiendo..." : "Subir todo"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.uploadOverlay} ${
          managerPanelOpen ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
        }`}
        aria-hidden={!managerPanelOpen}
      >
        <div className={styles.uploadSheet}>
          <div className={styles.uploadSheetHeader}>
            <div className={styles.uploadSheetTitleWrap}>
              <div className={styles.uploadHandle} />
              <div className={styles.uploadSheetTitle}>
                {managerForm.idRequestManager ? "Editar responsable" : "Asignar responsable"}
              </div>
              <div className={styles.uploadSheetNote}>
                Captura o actualiza la información del responsable de la solicitud
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
            <div className={styles.uploadListFullscreen}>
              <div className={styles.uploadRow}>
                <div className={styles.uploadControls}>
                  <select
                    className={styles.select}
                    value={managerForm.idAdministrativeUnit ?? ""}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        idAdministrativeUnit: e.target.value ? Number(e.target.value) : null,
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
                      <option key={u.idAdministrativeUnit} value={u.idAdministrativeUnit}>
                        {u.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.uploadRow}>
                <div className={styles.uploadControls}>
                  <input
                    className={styles.input}
                    placeholder="Nombre(s)"
                    value={managerForm.firstName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    disabled={savingManager}
                  />

                  <input
                    className={styles.input}
                    placeholder="Apellido paterno"
                    value={managerForm.lastName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    disabled={savingManager}
                  />

                  <input
                    className={styles.input}
                    placeholder="Apellido materno"
                    value={managerForm.secondLastName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({ ...prev, secondLastName: e.target.value }))
                    }
                    disabled={savingManager}
                  />
                </div>
              </div>

              <div className={styles.uploadRow}>
                <div className={styles.uploadControls}>
                  <input
                    className={styles.input}
                    placeholder="Correo electrónico"
                    value={managerForm.email}
                    onChange={(e) =>
                      setManagerForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    disabled={savingManager}
                  />

                  <input
                    className={styles.input}
                    placeholder="Teléfono"
                    value={managerForm.phone}
                    onChange={(e) =>
                      setManagerForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    disabled={savingManager}
                  />
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

      {previewOpen && currentPreview && (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Previsualización de archivo"
          onClick={closePreview}
        >
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
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
                  >
                    {autoPlay ? "Pausar" : "Reproducir"}
                  </button>
                )}

                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => openUrl(currentPreview.url)}
                >
                  Abrir aparte
                </button>

                {currentPreview.id && (
                  <button
                    type="button"
                    className={styles.iconDangerBtn}
                    onClick={() => void onDeleteCurrentPreview()}
                    disabled={deletingPreview}
                    title="Eliminar documento"
                    aria-label="Eliminar documento"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12M10 11v6M14 11v6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                <button type="button" className={styles.ghostBtn} onClick={closePreview}>
                  Cerrar
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
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
                          aria-label="Imagen anterior"
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
                          aria-label="Imagen siguiente"
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

                  {previewItems.length > 1 && (
                    <div className={styles.previewThumbs}>
                      {previewItems.map((item, idx) => (
                        <div
                          key={`${item.id ?? "thumb"}-${item.url}-${idx}`}
                          className={`${styles.previewThumbCard} ${
                            idx === previewIndex ? styles.previewThumbCardActive : ""
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
                            <img
                              src={item.url}
                              alt={item.name}
                              className={styles.previewThumbImg}
                            />
                          </button>

                          {item.id && (
                            <button
                              type="button"
                              className={styles.previewThumbDelete}
                              onClick={() => void onDeletePreviewDocumentByItem(item)}
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
              )}

              {isPdfPreview && (
                <div className={styles.previewPdfWrap}>
                  <iframe
                    src={currentPreview.url}
                    title={currentPreview.name}
                    className={styles.previewFrame}
                  />
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

                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => openUrl(currentPreview.url)}
                  >
                    Abrir archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}