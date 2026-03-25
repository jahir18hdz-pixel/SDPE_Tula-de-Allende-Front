import type {
  ChecklistFileItem,
  ChecklistRow,
  ManagerInfo,
  UnknownRecord,
} from "../types/expedient.types";

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts[1] ?? "",
    secondLastName: parts.slice(2).join(" ") ?? "",
  };
}

export function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function unwrapList(payload: unknown): unknown[] {
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

export function toStringSafe(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "1" || t === "si" || t === "sí";
  }
  return false;
}

export function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function normalizeUrlMaybe(u: string) {
  return (u ?? "").trim();
}

export function getExtensionFromSource(source: string) {
  const clean = source.split("?")[0].split("#")[0].trim().toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

export function getPreviewType(
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

export function normalizeChecklist(payload: unknown): ChecklistRow[] {
  const list = unwrapList(payload);

  return list
    .map((raw): ChecklistRow | null => {
      if (!isRecord(raw)) return null;

      const documentTypeId = toNumber(
        raw["documentTypeId"] ?? raw["DocumentTypeId"],
      );
      const documentName = toStringSafe(
        raw["documentName"] ?? raw["DocumentName"],
      ).trim();

      if (!documentTypeId || !documentName) return null;

      const requiredByRule = toBool(
        raw["requiredByRule"] ?? raw["RequiredByRule"],
      );
      const noApplies = toBool(raw["noApplies"] ?? raw["NoApplies"]);
      const uploaded = toBool(raw["uploaded"] ?? raw["Uploaded"]);

      const filesRaw = asArray(raw["files"] ?? raw["Files"]);

      const files: ChecklistFileItem[] = filesRaw
        .map((f): ChecklistFileItem | null => {
          if (!isRecord(f)) return null;

          const status = isRecord(f["status"] ?? f["Status"])
            ? (f["status"] ?? f["Status"])
            : null;

          return {
            id: toNumber(f["fileId"] ?? f["FileId"]),
            name:
              toStringSafe(f["fileName"] ?? f["FileName"]).trim() || "Archivo",
            url: normalizeUrlMaybe(
              toStringSafe(f["fileUrl"] ?? f["FileUrl"]),
            ),
            previewUrl:
              normalizeUrlMaybe(
                toStringSafe(f["previewUrl"] ?? f["PreviewUrl"]),
              ) || null,
            observation: toStringSafe(
              f["observation"] ?? f["Observation"],
            ).trim(),
            reviewObservation: toStringSafe(
              f["observationUpload"] ?? f["ObservationUpload"],
            ).trim(),
            status: toStringSafe(
              isRecord(status)
                ? status["description"] ?? status["Description"]
                : "",
            ).trim(),
          };
        })
        .filter((x): x is ChecklistFileItem => x !== null);

      return {
        documentTypeId,
        documentName,
        requiredByRule,
        noApplies,
        uploaded,
        globalStatus:
          toStringSafe(raw["globalStatus"] ?? raw["GlobalStatus"]).trim() ||
          (uploaded ? "Cargado" : "Pendiente"),
        observations: [],
        reviewObservations: [],
        statusDescriptions: [],
        files,
      };
    })
    .filter((x): x is ChecklistRow => x !== null);
}

export function getManagerDisplayName(m: ManagerInfo | null) {
  return m?.fullName?.trim() || "Sin responsable";
}

export function bytesToHuman(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}