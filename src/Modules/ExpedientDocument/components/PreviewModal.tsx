import React from "react";
import styles from "../styles/previewModal.module.css";
import type { PreviewItem } from "../types/expedient.types";

type Props = {
  open: boolean;
  previewItems: PreviewItem[];
  previewIndex: number;
  setPreviewIndex: React.Dispatch<React.SetStateAction<number>>;
  currentPreview: PreviewItem | null;
  autoPlay: boolean;
  setAutoPlay: React.Dispatch<React.SetStateAction<boolean>>;
  reviewingDocument: boolean;
  deletingPreview: boolean;
  showRejectBox: boolean;
  setShowRejectBox: React.Dispatch<React.SetStateAction<boolean>>;
  rejectComment: string;
  setRejectComment: React.Dispatch<React.SetStateAction<string>>;
  closePreview: () => void;
  openUrl: (u: string) => void;
  goPrevPreview: () => void;
  goNextPreview: () => void;
  openDeleteModal: (item: PreviewItem) => void;
  onApprove: () => void;
  onReject: () => void;
};

export default function PreviewModal({
  open,
  previewItems,
  previewIndex,
  setPreviewIndex,
  currentPreview,
  autoPlay,
  setAutoPlay,
  reviewingDocument,
  deletingPreview,
  showRejectBox,
  setShowRejectBox,
  rejectComment,
  setRejectComment,
  closePreview,
  openUrl,
  goPrevPreview,
  goNextPreview,
  openDeleteModal,
  onApprove,
  onReject,
}: Props) {
  if (!open || !currentPreview) return null;

  const isImagePreview = currentPreview.type === "image";
  const isPdfPreview = currentPreview.type === "pdf";
  const canMovePreview = previewItems.length > 1;
  const hasReviewObservation = Boolean(
    currentPreview.reviewObservation?.trim(),
  );

  const reviewStatus = (currentPreview.reviewStatus || "").toLowerCase();

  const statusBadgeClass = reviewStatus.includes("deneg")
    ? styles.badgeBad
    : reviewStatus.includes("aprob")
      ? styles.badgeOk
      : styles.badgeNeutral;

  const statusBlockClass = reviewStatus.includes("deneg")
    ? styles.blockBad
    : reviewStatus.includes("aprob")
      ? styles.blockOk
      : styles.blockNeutral;

  return (
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
                onClick={onApprove}
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
                {showRejectBox ? "Ocultar denegación" : "Denegar documento"}
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
          <div className={styles.previewBodySplit}>
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
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <aside className={styles.previewObservationPane}>
              <div className={styles.previewInfoBlock}>
                <div className={styles.previewInfoLabel}>Estado</div>
                <div
                  className={`${styles.previewMetaCard} ${statusBlockClass}`}
                >
                  <span className={`${styles.statusPill} ${statusBadgeClass}`}>
                    {currentPreview.reviewStatus || "Pendiente"}
                  </span>
                </div>
              </div>

              <div className={styles.previewInfoBlock}>
                <div className={styles.previewInfoLabel}>
                  Nombre del documento
                </div>
                <div
                  className={`${styles.previewMetaCard} ${statusBlockClass}`}
                >
                  <div
                    className={styles.previewMetaValue}
                    title={currentPreview.name}
                  >
                    {currentPreview.name || "Sin nombre"}
                  </div>
                </div>
              </div>

              

              <div className={styles.previewInfoBlock}>
                <div className={styles.previewInfoLabel}>Observaciones</div>

                <div
                  className={`${styles.previewObservationCard} ${statusBlockClass}`}
                >
                  {hasReviewObservation ? (
                    <div>
                      <strong>Observación:</strong>{" "}
                      {currentPreview.reviewObservation}
                    </div>
                  ) : (
                    <div className={styles.previewObservationEmpty}>
                      Este documento no tiene observaciones registradas.
                    </div>
                  )}
                </div>
              </div>

              {currentPreview.id && showRejectBox && (
                <div className={styles.previewInfoBlock}>
                  <div className={styles.previewInfoLabel}>
                    Denegar documento
                  </div>

                  <div className={`${styles.rejectBoxCard} ${styles.blockBad}`}>
                    <textarea
                      className={styles.rejectTextarea}
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="Escribe la razón por la que se deniega este documento..."
                      disabled={reviewingDocument || deletingPreview}
                    />

                    <div className={styles.rejectActions}>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => {
                          setShowRejectBox(false);
                          setRejectComment("");
                        }}
                        disabled={reviewingDocument || deletingPreview}
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={onReject}
                        disabled={
                          reviewingDocument ||
                          deletingPreview ||
                          !rejectComment.trim()
                        }
                      >
                        {reviewingDocument
                          ? "Procesando..."
                          : "Denegar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
