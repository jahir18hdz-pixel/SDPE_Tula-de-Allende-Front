import { useEffect, useMemo, useState } from "react";
import styles from "../styles/ClasificationDocumentsModal.module.css";
import { requestJson, authHeaders } from "../../../services/api";
import type { ToastType } from "../../../Components/layout/Toast";

type UnknownRecord = Record<string, unknown>;

type DocumentTypeRow = {
  idDocumentType?: number;
  IdDocumentType?: number;
  id?: number;
  Id?: number;

  documentName?: string;
  DocumentName?: string;
  name?: string;
  Name?: string;

  description?: string;
  Description?: string;
  descripcion?: string;
  Descripcion?: string;

  active?: boolean | number | string;
  Active?: boolean | number | string;
  isActive?: boolean | number | string;
  IsActive?: boolean | number | string;

  [key: string]: unknown;
};

type AssignedDocumentRow = {
  DocumentTypeId?: number;
  documentTypeId?: number;
  IdDocumentType?: number;
  idDocumentType?: number;

  IsRequired?: boolean | number | string;
  isRequired?: boolean | number | string;

  Active?: boolean | number | string;
  active?: boolean | number | string;

  Description?: string;
  description?: string;
  descripcion?: string;
  Descripcion?: string;

  Code?: number | string;
  code?: number | string;

  DocumentName?: string;
  documentName?: string;
  Name?: string;
  name?: string;

  [key: string]: unknown;
};

type AssignFormRow = {
  documentTypeId: number;
  documentName: string;
  description: string;
  checked: boolean;
  isRequired: boolean;
  active: boolean;
};

type Props = {
  open: boolean;
  classificationId: number | null;
  classificationName: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (type: ToastType, msg: string) => void;
};

type PagedResult = {
  items: DocumentTypeRow[];
  totalCount: number | null;
  page: number | null;
  pageSize: number | null;
};

const DOCUMENT_TYPE_BASE = "/api/DocumentType/paged";
const ASSIGNMENT_API = "/api/ClasificationDocumentType";
const PAGE_SIZE = 100;

export default function ClassificationDocumentsModal({
  open,
  classificationId,
  classificationName,
  onClose,
  onSaved,
  showToast,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AssignFormRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || classificationId == null) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classificationId]);

  async function loadData() {
    if (classificationId == null) return;

    setLoading(true);
    try {
      const [allDocs, assignedDocsResult] = await Promise.all([
        loadAllActiveDocumentTypes(),
        requestJson(`${ASSIGNMENT_API}/by-classification/${classificationId}`, {
          method: "GET",
          headers: authHeaders(),
        }),
      ]);

      const assignedDocs =
        assignedDocsResult.ok && assignedDocsResult.status !== 404
          ? extractAssignedList(assignedDocsResult.data)
          : [];

      const assignedMap = new Map<
        number,
        {
          isRequired: boolean;
          active: boolean;
          description: string;
          documentName: string;
        }
      >();

      for (const item of assignedDocs) {
        const id = getAssignedDocumentTypeId(item);
        if (id == null) continue;

        assignedMap.set(id, {
          isRequired: getAssignedIsRequired(item),
          active: getAssignedActive(item),
          description: getAssignedDescription(item) ?? "",
          documentName: getAssignedDocumentName(item) ?? "",
        });
      }

      const merged: AssignFormRow[] = allDocs
        .map((doc) => {
          const id = getDocumentTypeId(doc);
          if (id == null) return null;

          const assigned = assignedMap.get(id);

          return {
            documentTypeId: id,
            documentName:
              getDocumentTypeName(doc) ??
              assigned?.documentName ??
              `Documento ${id}`,
            description:
              getDocumentTypeDescription(doc) ?? assigned?.description ?? "",
            checked: Boolean(assigned),
            isRequired: assigned?.isRequired ?? false,
            active: assigned?.active ?? true,
          };
        })
        .filter((x): x is AssignFormRow => x !== null)
        .sort((a, b) => a.documentName.localeCompare(b.documentName, "es"));

      setRows(merged);
      setSearch("");
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllActiveDocumentTypes(): Promise<DocumentTypeRow[]> {
    const collected: DocumentTypeRow[] = [];
    let currentPage = 1;

    while (true) {
      const result = await requestJson(
        `${DOCUMENT_TYPE_BASE}?pageNumber=${currentPage}&pageSize=${PAGE_SIZE}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );

      if (!result.ok) {
        throw new Error(
          result.error || "No se pudieron cargar los tipos de documento.",
        );
      }

      const norm = normalizePagedDocumentTypes(result.data);
      const pageItems = norm.items ?? [];

      if (pageItems.length === 0) {
        break;
      }

      collected.push(...pageItems);

      if (pageItems.length < PAGE_SIZE) {
        break;
      }

      currentPage += 1;
    }

    const unique = new Map<number, DocumentTypeRow>();

    for (const doc of collected) {
      const id = getDocumentTypeId(doc);
      if (id == null) continue;

      if (!unique.has(id)) {
        unique.set(id, doc);
      }
    }

    return Array.from(unique.values()).filter(
      (doc) => getDocumentTypeActive(doc) === true,
    );
  }

  async function onSave() {
    if (classificationId == null) {
      showToast("error", "No se encontró la clasificación seleccionada.");
      return;
    }

    const documents = rows
      .filter((r) => r.checked)
      .map((r) => ({
        DocumentTypeId: r.documentTypeId,
        IsRequired: r.isRequired,
        Active: r.active,
      }));

    setSaving(true);
    try {
      const result = await requestJson(`${ASSIGNMENT_API}/assign`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          AcquisitionClassificationId: classificationId,
          Documents: documents,
        }),
      });

      if (!result.ok) {
        showToast("error", result.error || "No se pudo guardar la asignación.");
        return;
      }

      showToast("success", "Documentos asignados correctamente.");
      onSaved();
      onClose();
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const assignedRows = useMemo(() => {
    return rows
      .filter((r) => r.checked)
      .sort((a, b) => a.documentName.localeCompare(b.documentName, "es"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = !q
      ? [...rows]
      : rows.filter((row) => {
          const name = row.documentName.toLowerCase();
          const desc = row.description.toLowerCase();
          return name.includes(q) || desc.includes(q);
        });

    return filtered.sort((a, b) => {
      if (a.checked === b.checked) {
        return a.documentName.localeCompare(b.documentName, "es");
      }

      return a.checked ? 1 : -1;
    });
  }, [rows, search]);

  return (
    <div
      className={`${styles.uploadOverlay} ${
        open ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
      }`}
      aria-hidden={!open}
    >
      <div className={styles.uploadSheet}>
        <div className={styles.uploadSheetHeader}>
          <div className={styles.uploadSheetTitleWrap}>
            <div className={styles.uploadHandle} />

            <div className={styles.uploadSheetTitle}>
              Asignar tipos de documento a:{" "}
              <span className={styles.titleAccent}>
                {classificationName || "—"}
              </span>
            </div>

            <div className={styles.uploadSheetNote}>
              Selecciona los documentos que corresponden a esta clasificación y
              marca cuáles serán obligatorios.
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          <div className={styles.sheetGrid}>
            <section className={styles.managerSectionCard}>
              <div className={styles.sectionTitleRow}>
                <div className={styles.editorSectionTitleCompact}>
                  Documentos asignados
                </div>

                <span className={styles.counterBadge}>
                  {assignedRows.length}
                </span>
              </div>

              <div className={styles.assignedContent}>
                <div className={styles.documentsList}>
                  {loading ? (
                    <div className={styles.emptyState}>
                      Cargando documentos...
                    </div>
                  ) : assignedRows.length === 0 ? (
                    <div className={styles.emptyState}>
                      Esta clasificación aún no tiene documentos asignados.
                    </div>
                  ) : (
                    assignedRows.map((row) => (
                      <div
                        key={row.documentTypeId}
                        className={styles.assignedCard}
                      >
                        <button
                          type="button"
                          className={styles.removeAssignedBtn}
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((item) =>
                                item.documentTypeId === row.documentTypeId
                                  ? {
                                      ...item,
                                      checked: false,
                                      isRequired: false,
                                    }
                                  : item,
                              ),
                            )
                          }
                          disabled={saving}
                          aria-label={`Quitar ${row.documentName}`}
                          title="Quitar documento"
                        >
                          ×
                        </button>

                        <div className={styles.assignedInfo}>
                          <div className={styles.documentName}>
                            {row.documentName || "Sin nombre"}
                          </div>
                          <div className={styles.documentDesc}>
                            {row.description || "Sin descripción"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className={styles.managerSectionCard}>
              <div className={styles.sectionTitleRow}>
                <div className={styles.editorSectionTitleCompact}>
                  Tipos de documentos
                </div>

                <span className={styles.counterBadge}>
                  {filteredRows.length}
                </span>
              </div>

              <div className={styles.rightContent}>
                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>Buscar</span>
                  <input
                    className={styles.editorFloatingInput}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar tipo de documento..."
                    disabled={loading || saving}
                  />
                </div>

                <div className={styles.documentsList}>
                  {loading ? (
                    <div className={styles.emptyState}>
                      Cargando tipos de documento...
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <div className={styles.emptyState}>
                      {search.trim()
                        ? "No se encontraron tipos de documento con esa búsqueda."
                        : "No hay tipos de documento activos disponibles."}
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <div
                        key={row.documentTypeId}
                        className={styles.documentCard}
                      >
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => {
                              const checked = e.target.checked;

                              setRows((prev) =>
                                prev.map((item) =>
                                  item.documentTypeId === row.documentTypeId
                                    ? {
                                        ...item,
                                        checked,
                                        isRequired: checked
                                          ? item.isRequired
                                          : false,
                                      }
                                    : item,
                                ),
                              );
                            }}
                            disabled={saving}
                          />

                          <div className={styles.documentInfo}>
                            <div className={styles.documentName}>
                              {row.documentName || "Sin nombre"}
                            </div>
                            <div className={styles.documentDesc}>
                              {row.description || "Sin descripción"}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className={styles.uploadSheetFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => void onSave()}
            disabled={saving || loading}
          >
            {saving ? "Guardando..." : "Guardar asignación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizePagedDocumentTypes(payload: unknown): PagedResult {
  if (Array.isArray(payload)) {
    return {
      items: payload as DocumentTypeRow[],
      totalCount: null,
      page: null,
      pageSize: null,
    };
  }

  const obj = isRecord(payload) ? payload : {};

  const itemsRaw =
    obj.items ??
    obj.Items ??
    obj.data ??
    obj.Data ??
    obj.documentTypes ??
    obj.DocumentTypes ??
    obj.result ??
    obj.Result ??
    obj.value ??
    obj.Value ??
    obj.values ??
    obj.Values;

  let items: DocumentTypeRow[] = [];
  if (Array.isArray(itemsRaw)) {
    items = itemsRaw as DocumentTypeRow[];
  } else {
    const deep = findArrayDeep(payload, 0);
    items = deep ? (deep as DocumentTypeRow[]) : [];
  }

  const totalCountRaw =
    obj.totalCount ?? obj.TotalCount ?? obj.total ?? obj.Total ?? null;

  const pageRaw =
    obj.pageNumber ?? obj.PageNumber ?? obj.page ?? obj.Page ?? null;

  const pageSizeRaw = obj.pageSize ?? obj.PageSize ?? null;

  return {
    items,
    totalCount:
      totalCountRaw != null && Number.isFinite(Number(totalCountRaw))
        ? Number(totalCountRaw)
        : null,
    page:
      pageRaw != null && Number.isFinite(Number(pageRaw))
        ? Number(pageRaw)
        : null,
    pageSize:
      pageSizeRaw != null && Number.isFinite(Number(pageSizeRaw))
        ? Number(pageSizeRaw)
        : null,
  };
}

function extractAssignedList(payload: unknown): AssignedDocumentRow[] {
  if (Array.isArray(payload)) return payload as AssignedDocumentRow[];

  if (isRecord(payload) && Array.isArray((payload as UnknownRecord).$values)) {
    return (payload as UnknownRecord).$values as AssignedDocumentRow[];
  }

  const obj = isRecord(payload) ? (payload as UnknownRecord) : null;
  if (!obj) return [];

  const possible =
    obj.items ??
    obj.Items ??
    obj.data ??
    obj.Data ??
    obj.result ??
    obj.Result ??
    obj.value ??
    obj.Value ??
    obj.values ??
    obj.Values;

  if (Array.isArray(possible)) return possible as AssignedDocumentRow[];

  const deep = findArrayDeep(payload, 0);
  return deep ? (deep as AssignedDocumentRow[]) : [];
}

function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
  if (depth > 6) return null;
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return null;

  const obj = payload as UnknownRecord;
  const values = obj["$values"];
  if (Array.isArray(values)) return values;

  const keys = [
    "data",
    "result",
    "items",
    "value",
    "values",
    "documentTypes",
    "Items",
    "Data",
    "Result",
    "DocumentTypes",
    "Values",
    "Value",
  ];

  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
    const nested = findArrayDeep(v, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function getDocumentTypeId(u: DocumentTypeRow | null): number | null {
  if (!u) return null;
  const v = u.idDocumentType ?? u.IdDocumentType ?? u.id ?? u.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDocumentTypeName(u: DocumentTypeRow | null): string | null {
  if (!u) return null;
  const v = u.documentName ?? u.DocumentName ?? u.name ?? u.Name;
  const s = asTrim(v ?? "");
  return s || null;
}

function getDocumentTypeDescription(u: DocumentTypeRow | null): string | null {
  if (!u) return null;
  const v = u.description ?? u.Description ?? u.descripcion ?? u.Descripcion;
  const s = asTrim(v ?? "");
  return s || null;
}

function getDocumentTypeActive(u: DocumentTypeRow | null): boolean | null {
  if (!u) return null;
  return getBooleanValue(u.active ?? u.Active ?? u.isActive ?? u.IsActive);
}

function getAssignedDocumentTypeId(
  u: AssignedDocumentRow | null,
): number | null {
  if (!u) return null;
  const v =
    u.DocumentTypeId ??
    u.documentTypeId ??
    u.IdDocumentType ??
    u.idDocumentType;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getAssignedDocumentName(u: AssignedDocumentRow | null): string | null {
  if (!u) return null;
  const v =
    u.DocumentName ?? u.documentName ?? u.Name ?? u.name ?? u.Code ?? u.code;
  const s = asTrim(v ?? "");
  return s || null;
}

function getAssignedDescription(u: AssignedDocumentRow | null): string | null {
  if (!u) return null;
  const v = u.Description ?? u.description ?? u.descripcion ?? u.Descripcion;
  const s = asTrim(v ?? "");
  return s || null;
}

function getAssignedIsRequired(u: AssignedDocumentRow | null): boolean {
  if (!u) return false;
  return getBooleanValue(u.IsRequired ?? u.isRequired) ?? false;
}

function getAssignedActive(u: AssignedDocumentRow | null): boolean {
  if (!u) return true;
  return getBooleanValue(u.Active ?? u.active) ?? true;
}

function getBooleanValue(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;

  if (typeof v === "string") {
    const t = asTrim(v).toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }

  return null;
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function asTrim(v: unknown): string {
  return asString(v).trim();
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