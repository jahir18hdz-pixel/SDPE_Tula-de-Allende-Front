export type ChecklistFileItem = {
  id: number | null;
  name: string;
  url: string;
  previewUrl?: string | null;
  observation?: string;
  reviewObservation?: string;
  status?: string;
};

export type ChecklistRow = {
  documentTypeId: number;
  documentName: string;
  requiredByRule: boolean;
  noApplies: boolean;
  uploaded: boolean;
  globalStatus: string;
  observations: string[];
  reviewObservations: string[];
  statusDescriptions: string[];
  files: {
    id: number | null;
    name: string;
    url: string;
    previewUrl?: string | null;
    observation?: string;
    reviewObservation?: string;
    status?: string;
  }[];
};

export type UploadRow = {
  file: File;
  documentTypeId: number | null;
  observations: string;
};

export type RequestOk = { ok: true; data: unknown; status: number };
export type RequestErr = { ok: false; error: string; status: number };
export type RequestResult = RequestOk | RequestErr;

export type ManagerInfo = {
  idRequestManager: number;
  fullName: string;
  requestNumber?: string | null;
  administrativeUnit?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type AdministrativeUnitOption = {
  idAdministrativeUnit: number;
  description: string;
};

export type ManagerFormState = {
  idRequestManager: number | null;
  idAdministrativeUnit: number | null;
  firstName: string;
  lastName: string;
  secondLastName: string;
  email: string;
  phone: string;
};

export type PaymentPolicyOption = {
  idPaymentPolicy: number;
  policyCode: string;
  description?: string | null;
};

export type PolicyFormState = {
  idPaymentPolicy: number | null;
};

export type CfdiFormState = {
  cfdi: string;
};

export type ChecklistExceptionRow = {
  documentTypeId: number;
  documentName: string;
  doesNotApply: boolean;
  justification: string;
  uploaded: boolean;
};

export type PreviewItem = {
  id: number | null;
  url: string;
  name: string;
  type: "image" | "pdf" | "other";
  reviewObservation?: string | null;
  reviewStatus?: string | null;
};

export type UnknownRecord = Record<string, unknown>;