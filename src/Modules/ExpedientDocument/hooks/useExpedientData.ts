import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authHeaders, requestJson } from "../../../services/api";
import type { ToastType } from "../../../Components/layout/Toast";

import type {
  AdministrativeUnitOption,
  CfdiFormState,
  ChecklistExceptionRow,
  ChecklistRow,
  ManagerFormState,
  ManagerInfo,
  PaymentPolicyOption,
  PolicyFormState,
  PreviewItem,
  RequestResult,
  UploadRow,
  UnknownRecord,
} from "../types/expedient.types";

import {
  getPreviewType,
  getManagerDisplayName,
  isRecord,
  normalizeUrlMaybe,
  splitFullName,
  toNumber,
  toStringSafe,
  unwrapList,
} from "../utils/expedient.utils";

import {
  ADMIN_UNIT_API,
  DOCUMENT_STATUS_APPROVED,
  DOCUMENT_STATUS_REJECTED,
  EXPEDIENT_API,
  MANAGER_API,
  PAYMENT_POLICY_API,
  REQUEST_DETAIL_API,
  REQUEST_DOCUMENT_EXCEPTION_API,
} from "../constants/expedient.contants";

type UseExpedientDataProps = {
  requestId: number;
  canUse: boolean;
  showToast: (type: ToastType, msg: string) => void;
};

function normalizeChecklistWithGlobalStatus(payload: unknown): ChecklistRow[] {
  const list = unwrapList(payload);

  return list
    .map((raw): ChecklistRow | null => {
      if (!isRecord(raw)) return null;

      const documentTypeId = toNumber(raw["documentTypeId"] ?? raw["DocumentTypeId"]);
      const documentName = toStringSafe(
        raw["documentName"] ?? raw["DocumentName"],
      ).trim();

      if (!documentTypeId || !documentName) return null;

      const requiredByRule = Boolean(raw["requiredByRule"] ?? raw["RequiredByRule"]);
      const noApplies = Boolean(raw["noApplies"] ?? raw["NoApplies"]);
      const uploaded = Boolean(raw["uploaded"] ?? raw["Uploaded"]);
      const globalStatus = toStringSafe(
        raw["globalStatus"] ?? raw["GlobalStatus"],
      ).trim();

      const filesRaw = Array.isArray(raw["files"] ?? raw["Files"])
        ? ((raw["files"] ?? raw["Files"]) as unknown[])
        : [];

      const files = filesRaw
        .map((file): ChecklistRow["files"][number] | null => {
          if (!isRecord(file)) return null;

          const statusRaw = isRecord(file["status"] ?? file["Status"])
            ? ((file["status"] ?? file["Status"]) as Record<string, unknown>)
            : null;

          return {
            id: toNumber(file["fileId"] ?? file["FileId"]),
            name: toStringSafe(file["fileName"] ?? file["FileName"]).trim() || "Archivo",
            url: normalizeUrlMaybe(
              toStringSafe(file["fileUrl"] ?? file["FileUrl"]),
            ),
            previewUrl: normalizeUrlMaybe(
              toStringSafe(file["previewUrl"] ?? file["PreviewUrl"]),
            ),
            observation: toStringSafe(
              file["observation"] ?? file["Observation"],
            ).trim(),
            reviewObservation: toStringSafe(
              file["observationUpload"] ?? file["ObservationUpload"],
            ).trim(),
            status: toStringSafe(
              statusRaw?.["description"] ?? statusRaw?.["Description"],
            ).trim(),
          };
        })
        .filter(
          (file): file is ChecklistRow["files"][number] => file !== null,
        );

      return {
        documentTypeId,
        documentName,
        requiredByRule,
        noApplies,
        uploaded,
        globalStatus: globalStatus || (uploaded ? "Cargado" : "Pendiente"),
        observations: [],
        reviewObservations: [],
        statusDescriptions: [],
        files,
      };
    })
    .filter((item): item is ChecklistRow => item !== null);
}

export function useExpedientData({
  requestId,
  canUse,
  showToast,
}: UseExpedientDataProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const [activePanel, setActivePanel] = useState<
    "manager" | "policy" | "cfdi" | "checklist" | null
  >(null);

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

  const [savingPolicy, setSavingPolicy] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [paymentPolicies, setPaymentPolicies] = useState<PaymentPolicyOption[]>(
    [],
  );
  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    idPaymentPolicy: null,
  });

  const [savingCfdi, setSavingCfdi] = useState(false);
  const [cfdiForm, setCfdiForm] = useState<CfdiFormState>({
    cfdi: "",
  });

  const [savingChecklist, setSavingChecklist] = useState(false);
  const [checklistExceptionRows, setChecklistExceptionRows] = useState<
    ChecklistExceptionRow[]
  >([]);

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

  const closeDeleteModal = useCallback(() => {
    if (deletingPreview) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeletePassword("");
  }, [deletingPreview]);

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

  const closeActivePanel = useCallback(() => {
    setActivePanel(null);
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

      const found =
        (list.find((x) => {
          if (!isRecord(x)) return false;

          const idRequest = toNumber(
            x["idRequest"] ??
              x["IdRequest"] ??
              x["requestId"] ??
              x["RequestId"],
          );

          return idRequest === requestId;
        }) as UnknownRecord) ?? null;

      if (!found) {
        setManager(null);
        return;
      }

      const idRequestManager = toNumber(
        found["idRequestManager"] ?? found["IdRequestManager"],
      );

      const firstName = toStringSafe(
        found["firstName"] ?? found["FirstName"],
      ).trim();

      const lastName = toStringSafe(
        found["lastName"] ?? found["LastName"],
      ).trim();

      const secondLastName = toStringSafe(
        found["secondLastName"] ?? found["SecondLastName"],
      ).trim();

      const fullNameDirect = toStringSafe(
        found["fullName"] ?? found["FullName"],
      ).trim();

      const fullName =
        fullNameDirect ||
        [firstName, lastName, secondLastName].filter(Boolean).join(" ").trim();

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
  }, [canUse, requestId]);

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

      const list = normalizeChecklistWithGlobalStatus(res.data);

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
  const canMovePreview = previewItems.length > 1;
  const isImagePreview = currentPreview?.type === "image";

  const openPreviewFromFiles = useCallback(
    (row: ChecklistRow, selectedIndex = 0) => {
      const { documentName, files } = row;

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
            reviewObservation: file.reviewObservation ?? null,
            reviewStatus: file.status ?? null,
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
      if (e.key === "ArrowLeft" && canMovePreview && !deleteModalOpen) {
        goPrevPreview();
      }
      if (e.key === "ArrowRight" && canMovePreview && !deleteModalOpen) {
        goNextPreview();
      }
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
    setActivePanel("checklist");
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
      setActivePanel(null);
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

    setActivePanel("manager");
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

    setActivePanel("policy");
  }

  async function openCfdiPanel() {
    if (!canUse) return;

    setCfdiForm({
      cfdi: cfdi?.trim() || "",
    });

    setActivePanel("cfdi");
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

      setActivePanel(null);
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
      setActivePanel(null);
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
      setActivePanel(null);
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

  return {
    fileInputRef,

    requestNumber,
    policyNumber,
    cfdi,

    loadingManager,
    manager,

    loadingChecklist,
    checklist,
    searchText,
    setSearchText,

    uploads,
    setUploads,
    uploading,
    showUploadPanel,
    setShowUploadPanel,

    previewOpen,
    previewItems,
    previewIndex,
    setPreviewIndex,
    autoPlay,
    setAutoPlay,
    deletingPreview,
    reviewingDocument,
    showRejectBox,
    setShowRejectBox,
    rejectObservations,
    setRejectObservations,

    deleteModalOpen,
    deleteTarget,
    deletePassword,
    setDeletePassword,

    activePanel,
    closeActivePanel,

    savingManager,
    loadingAdministrativeUnits,
    administrativeUnits,
    managerForm,
    setManagerForm,

    savingPolicy,
    loadingPolicies,
    paymentPolicies,
    policyForm,
    setPolicyForm,

    savingCfdi,
    cfdiForm,
    setCfdiForm,

    savingChecklist,
    checklistExceptionRows,
    setChecklistExceptionRows,

    stats,
    filteredChecklist,
    checklistOptions,
    currentPreview,

    openUrl,
    closePreview,
    openDeleteModal,
    closeDeleteModal,
    openPreviewFromFiles,
    goPrevPreview,
    goNextPreview,

    onPickFiles,
    onRemoveUpload,
    onBindFromChecklist,
    openChecklistPanel,
    openManagerPanel,
    openPolicyPanel,
    openCfdiPanel,
    onSaveChecklistExceptions,
    onSaveManager,
    onSavePolicy,
    onSaveCfdi,
    onUploadMassive,
    onDeletePreviewDocumentByItem,
    onReviewPreviewDocument,

    dropHandlers,
    getManagerDisplayName,
    DOCUMENT_STATUS_APPROVED,
    DOCUMENT_STATUS_REJECTED,
  };
}