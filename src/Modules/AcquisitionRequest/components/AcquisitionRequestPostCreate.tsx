import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AcquisitionRequestPostCreate.module.css";
import { requestJson, authHeaders } from "../../../services/api";
import type { ToastType } from "../../../Components/layout/Toast";

type CatalogItem = { id: number; name: string };

type ManagerForm = {
  idAdministrativeUnit: number | null;
  firstName: string;
  lastName: string;
  secondLastName: string;
  email: string;
  phone: string;
};

type DocState = {
  idDocumentType: number;
  name: string;
  requiredByRule: boolean;
  applies: boolean;
};

type Props = {
  idRequest: number;
  classificationId: number | null;
  administrativeUnits: CatalogItem[];
  initialAdministrativeUnitId?: number | null;
  onSuccess?: () => void;
  showToast: (type: ToastType, msg: string) => void;
};

const MANAGER_API = "/api/RequestManager";
const DOC_EXCEPTION_TOGGLE = "/api/RequestDocumentException/toggle";

const DOCS_ENDPOINT = (idAcqClass: number) =>
  `/api/ClasificationDocumentType/by-classification/${idAcqClass}`;

const initialManagerState = (
  initialAdministrativeUnitId?: number | null,
): ManagerForm => ({
  idAdministrativeUnit: initialAdministrativeUnitId ?? null,
  firstName: "",
  lastName: "",
  secondLastName: "",
  email: "",
  phone: "",
});

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

function toNullableNumber(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNullableString(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}

function capitalizeFirst(value: string): string {
  const text = value.replace(/^\s+/, "");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeNameInput(value: string): string {
  return capitalizeFirst(value);
}

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

export default function AcquisitionRequestPostCreate({
  idRequest,
  classificationId,
  administrativeUnits,
  initialAdministrativeUnitId = null,
  onSuccess,
  showToast,
}: Props) {
  const navigate = useNavigate();

  const [savingManager, setSavingManager] = useState(false);
  const [managerSaved, setManagerSaved] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsSaving, setDocsSaving] = useState(false);

  const [manager, setManager] = useState<ManagerForm>(
    initialManagerState(initialAdministrativeUnitId),
  );
  const [docs, setDocs] = useState<DocState[]>([]);

  const postDisabled = savingManager || docsSaving || docsLoading;

  const loadDocsByClassification = useCallback(async () => {
    if (!classificationId) {
      setDocs([]);
      return;
    }

    setDocsLoading(true);
    try {
      const res = await requestJson(DOCS_ENDPOINT(classificationId), {
        method: "GET",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error(res.error);

      const payload = res.data;
      const arr: unknown[] = Array.isArray(payload)
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

      const mapped: DocState[] = arr
        .map((raw): DocState | null => {
          if (!isRecord(raw)) return null;

          const id = toNumber(
            getValue(raw, [
              "documentTypeId",
              "DocumentTypeId",
              "idDocumentType",
              "IdDocumentType",
            ]),
          );
          if (!id || id <= 0) return null;

          const name = toStringSafe(
            getValue(raw, [
              "documentName",
              "DocumentName",
              "name",
              "Name",
              "description",
              "Description",
            ]),
          ).trim();
          if (!name) return null;

          const reqRaw = getValue(raw, [
            "isRequired",
            "IsRequired",
            "requiredByRule",
            "RequiredByRule",
          ]);
          const requiredByRule = typeof reqRaw === "boolean" ? reqRaw : true;

          return {
            idDocumentType: id,
            name,
            requiredByRule,
            applies: true,
          };
        })
        .filter((x): x is DocState => x !== null);

      setDocs(mapped);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [classificationId, showToast]);

  useEffect(() => {
    void loadDocsByClassification();
  }, [loadDocsByClassification]);

  function validateManager(): string {
    if (!manager.email.trim()) return "El correo electrónico es obligatorio.";
    if (!isValidEmail(manager.email))
      return "Ingresa un correo electrónico válido.";

    if (manager.phone.trim() && manager.phone.trim().length !== 10) {
      return "El teléfono debe contener exactamente 10 dígitos.";
    }

    return "";
  }

  async function onSaveManager() {
    const msg = validateManager();
    if (msg) return showToast("error", msg);

    setSavingManager(true);
    try {
      const payload = {
        idRequest,
        idAdministrativeUnit: manager.idAdministrativeUnit,
        firstName: toNullableString(manager.firstName),
        lastName: toNullableString(manager.lastName),
        secondLastName: toNullableString(manager.secondLastName),
        email: manager.email.trim(),
        phone: toNullableString(manager.phone),
      };

      const res = await requestJson(MANAGER_API, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) return showToast("error", res.error);

      setManagerSaved(true);
      showToast("success", "Responsable registrado.");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSavingManager(false);
    }
  }

  function validateDocs(): string {
    if (!managerSaved) return "Primero guarda el responsable.";

    const bad = docs.find(
      (d) => !Number.isFinite(d.idDocumentType) || d.idDocumentType <= 0,
    );
    if (bad) return `Documento con Id inválido: ${bad.name}`;

    return "";
  }

  async function onSaveDocsChecklist() {
    const msg = validateDocs();
    if (msg) return showToast("error", msg);

    setDocsSaving(true);
    try {
      const payload = {
        idRequest,
        documents: docs.map((d) => ({
          idDocumentType: d.idDocumentType,
          doesNotApply: !d.applies,
          justification: "",
        })),
      };

      const res = await requestJson(DOC_EXCEPTION_TOGGLE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) return showToast("error", res.error);

      showToast("success", "Checklist guardado correctamente.");

      if (onSuccess) onSuccess();
      else navigate("/home");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setDocsSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.detailCard}>
        <div className={styles.sectionTitle}>Responsable</div>

        <div className={styles.grid3}>
          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>
              Unidad administrativa
            </span>
            <select
              className={styles.floatingSelect}
              value={manager.idAdministrativeUnit ?? ""}
              onChange={(e) =>
                setManager((p) => ({
                  ...p,
                  idAdministrativeUnit: toNullableNumber(e.target.value),
                }))
              }
              disabled={postDisabled}
            >
              <option value="">Selecciona...</option>
              {administrativeUnits.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Nombre(s)</span>
            <input
              className={styles.floatingInput}
              value={manager.firstName}
              onChange={(e) =>
                setManager((p) => ({
                  ...p,
                  firstName: normalizeNameInput(e.target.value),
                }))
              }
              disabled={postDisabled}
              placeholder="Ej. Juan"
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Apellido paterno</span>
            <input
              className={styles.floatingInput}
              value={manager.lastName}
              onChange={(e) =>
                setManager((p) => ({
                  ...p,
                  lastName: normalizeNameInput(e.target.value),
                }))
              }
              disabled={postDisabled}
              placeholder="Ej. Pérez"
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Apellido materno</span>
            <input
              className={styles.floatingInput}
              value={manager.secondLastName}
              onChange={(e) =>
                setManager((p) => ({
                  ...p,
                  secondLastName: normalizeNameInput(e.target.value),
                }))
              }
              disabled={postDisabled}
              placeholder="Ej. López"
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>
              Email <span className={styles.required}>*</span>
            </span>
            <input
              className={styles.floatingInput}
              type="email"
              value={manager.email}
              onChange={(e) =>
                setManager((p) => ({ ...p, email: e.target.value.trimStart() }))
              }
              disabled={postDisabled}
              placeholder="correo@dominio.com"
            />
          </div>

          <div className={styles.floatingField}>
            <span className={styles.floatingLabel}>Teléfono</span>
            <input
              className={styles.floatingInput}
              value={manager.phone}
              onChange={(e) =>
                setManager((p) => ({
                  ...p,
                  phone: sanitizePhoneInput(e.target.value),
                }))
              }
              disabled={postDisabled}
              placeholder="Ej. 7711234567"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => void onSaveManager()}
            disabled={postDisabled}
          >
            {savingManager
              ? "Guardando..."
              : managerSaved
                ? "Responsable guardado"
                : "Guardar responsable"}
          </button>
        </div>

        <div className={styles.sectionTitle}>Documentos por clasificación</div>

        {!managerSaved && (
          <div className={styles.docsHint}>
            Primero guarda el responsable para habilitar el checklist.
          </div>
        )}

        <div className={styles.docsWrap}>
          {docsLoading && (
            <div className={styles.docsHint}>Cargando documentos...</div>
          )}

          {!docsLoading && docs.length === 0 && (
            <div className={styles.docsHint}>
              No hay documentos para esta clasificación.
            </div>
          )}

          {docs.map((d) => {
            const rowClass = d.applies
              ? styles.docRow
              : `${styles.docRow} ${styles.docRowInactive}`;

            const miniClass = d.applies
              ? styles.docMini
              : `${styles.docMini} ${styles.docMiniInactive}`;

            return (
              <div key={d.idDocumentType} className={rowClass}>
                <div className={styles.docLeft}>
                  <label className={styles.docName}>
                    <input
                      type="checkbox"
                      checked={d.applies}
                      onChange={(e) =>
                        setDocs((prev) =>
                          prev.map((x) =>
                            x.idDocumentType === d.idDocumentType
                              ? { ...x, applies: e.target.checked }
                              : x,
                          ),
                        )
                      }
                      disabled={postDisabled || !managerSaved}
                    />
                    <span>{d.name}</span>
                  </label>

                  <div className={miniClass}>
                    {d.applies
                      ? d.requiredByRule
                        ? "Aplica / Obligatorio por clasificación"
                        : "Aplica / Opcional por clasificación"
                      : "No aplica para esta solicitud"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSave}
            onClick={() => void onSaveDocsChecklist()}
            disabled={postDisabled || !managerSaved}
          >
            {docsSaving ? "Guardando..." : "Guardar checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}