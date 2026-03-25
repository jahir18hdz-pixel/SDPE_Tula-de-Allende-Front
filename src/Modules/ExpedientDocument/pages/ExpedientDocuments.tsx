import { useNavigate, useParams } from "react-router-dom";
import styles from "../styles/ExpedientDocuments.module.css";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ChecklistTable from "../components/ChecklistTable";
import UploadPanel from "../components/UploadPanel";
import ManagerPanel from "../components/ManagerPanel";
import PolicyPanel from "../components/PolicyPanel";
import CfdiPanel from "../components/CfdiPanel";
import ChecklistEditorPanel from "../components/ChecklistEditorPanel";
import PreviewModal from "../components/PreviewModal";
import RejectDocumentModal from "../components/RejectDocumentModal";
import DeleteDocumentModal from "../components/DeleteDocumentModal";
import ExpedientHeaderInfo from "../components/ExpedientHeaderInfo";
import { useCallback, useMemo, useState } from "react";
import { useExpedientData } from "../hooks/useExpedientData";

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

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
  setToastType(type);
  setToastMsg(msg);
  setToastOpen(true);
}, []);



  const {
    fileInputRef,

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
  } = useExpedientData({
    requestId,
    canUse,
    showToast,
  });

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
        className={`${styles.mainContent} ${
          previewOpen ? styles.mainContentBlurred : ""
        }`}
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

                <ExpedientHeaderInfo
                  canUse={canUse}
                  loadingManager={loadingManager}
                  manager={manager}
                  policyNumber={policyNumber}
                  cfdi={cfdi}
                  savingManager={savingManager}
                  savingPolicy={savingPolicy}
                  savingCfdi={savingCfdi}
                  savingChecklist={savingChecklist}
                  onOpenManager={() => void openManagerPanel()}
                  onOpenPolicy={() => void openPolicyPanel()}
                  onOpenCfdi={() => void openCfdiPanel()}
                  onOpenChecklist={openChecklistPanel}
                  getManagerDisplayName={getManagerDisplayName}
                />
              </div>
            </div>

            <input
              ref={fileInputRef}
              className={styles.hiddenFile}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const arr = Array.from(e.target.files);

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

                e.currentTarget.value = "";
              }}
            />

            <ChecklistTable
              canUse={canUse}
              loadingChecklist={loadingChecklist}
              checklist={checklist}
              filteredChecklist={filteredChecklist}
              searchText={searchText}
              showToast={showToast}
              openPreviewFromFiles={openPreviewFromFiles}
            />
          </section>
        </div>
      </div>

      <UploadPanel
        open={showUploadPanel}
        canUse={canUse}
        uploading={uploading}
        uploads={uploads}
        checklistOptions={checklistOptions}
        onClose={() => setShowUploadPanel(false)}
        onPickFiles={onPickFiles}
        onRemoveUpload={onRemoveUpload}
        onBindFromChecklist={onBindFromChecklist}
        setUploads={setUploads}
        onUploadMassive={() => void onUploadMassive()}
        dropHandlers={dropHandlers}
      />

      <ManagerPanel
        open={activePanel === "manager"}
        saving={savingManager}
        loadingAdministrativeUnits={loadingAdministrativeUnits}
        administrativeUnits={administrativeUnits}
        managerForm={managerForm}
        setManagerForm={setManagerForm}
        onClose={closeActivePanel}
        onSave={() => void onSaveManager()}
      />

      <PolicyPanel
        open={activePanel === "policy"}
        savingPolicy={savingPolicy}
        loadingPolicies={loadingPolicies}
        paymentPolicies={paymentPolicies}
        policyForm={policyForm}
        setPolicyForm={setPolicyForm}
        policyNumber={policyNumber}
        onClose={closeActivePanel}
        onSave={() => void onSavePolicy()}
      />

      <CfdiPanel
        open={activePanel === "cfdi"}
        savingCfdi={savingCfdi}
        cfdi={cfdi}
        cfdiForm={cfdiForm}
        setCfdiForm={setCfdiForm}
        onClose={closeActivePanel}
        onSave={() => void onSaveCfdi()}
      />

      <ChecklistEditorPanel
        open={activePanel === "checklist"}
        savingChecklist={savingChecklist}
        checklistExceptionRows={checklistExceptionRows}
        setChecklistExceptionRows={setChecklistExceptionRows}
        onClose={closeActivePanel}
        onSave={() => void onSaveChecklistExceptions()}
      />

      <PreviewModal
        open={previewOpen}
        previewItems={previewItems}
        previewIndex={previewIndex}
        setPreviewIndex={setPreviewIndex}
        currentPreview={currentPreview}
        autoPlay={autoPlay}
        setAutoPlay={setAutoPlay}
        reviewingDocument={reviewingDocument}
        deletingPreview={deletingPreview}
        showRejectBox={showRejectBox}
        setShowRejectBox={setShowRejectBox}
        closePreview={closePreview}
        openUrl={openUrl}
        goPrevPreview={goPrevPreview}
        goNextPreview={goNextPreview}
        openDeleteModal={openDeleteModal}
        onApprove={() =>
          currentPreview &&
          void onReviewPreviewDocument(
            currentPreview,
            DOCUMENT_STATUS_APPROVED,
          )
        }
      />

      <RejectDocumentModal
        open={previewOpen && showRejectBox}
        currentPreview={currentPreview}
        rejectObservations={rejectObservations}
        setRejectObservations={setRejectObservations}
        reviewingDocument={reviewingDocument}
        onClose={() => {
          setShowRejectBox(false);
          setRejectObservations("");
        }}
        onConfirm={() =>
          currentPreview &&
          void onReviewPreviewDocument(
            currentPreview,
            DOCUMENT_STATUS_REJECTED,
            rejectObservations,
          )
        }
      />

      <DeleteDocumentModal
        open={deleteModalOpen}
        deleteTarget={deleteTarget}
        deletePassword={deletePassword}
        setDeletePassword={setDeletePassword}
        deletingPreview={deletingPreview}
        onClose={closeDeleteModal}
        onConfirm={() =>
          deleteTarget &&
          void onDeletePreviewDocumentByItem(
            deleteTarget,
            deletePassword,
          )
        }
      />
    </div>
  );
}