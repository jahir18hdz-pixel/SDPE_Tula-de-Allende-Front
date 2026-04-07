import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Permissions.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ConfirmDialog from "../../../Components/layout/ConfirmDialog";
import { requestJson, readToken } from "../../../services/api";

type Role = {
  idRol?: number;
  IdRol?: number;
  id?: number;
  Id?: number;

  rolName?: string;
  RolName?: string;
  roleName?: string;
  RoleName?: string;
  name?: string;
  Name?: string;

  active?: boolean | number | string;
  Active?: boolean | number | string;
  isActive?: boolean | number | string;
  IsActive?: boolean | number | string;

  [key: string]: unknown;
};

type PermissionApi = {
  IdPermiso?: number;
  Modulo?: string | null;
  Accion?: string | null;
  Asignado?: boolean | number | string | null;

  idPermiso?: number;
  modulo?: string | null;
  accion?: string | null;
  asignado?: boolean | number | string | null;

  [key: string]: unknown;
};

type PermissionState = {
  id: number;
  modulo: string;
  accion: string;
  nombre: string;
  descripcion: string;
  asignado: boolean;
};

type UnknownRecord = Record<string, unknown>;
type UnknownObject = Record<string, unknown>;

const ROLES_ENDPOINTS = [
  "/api/Role",
  "/api/role",
  "/api/Roles",
  "/api/roles",
  "/api/Roles/all",
  "/api/roles/all",
];

const PERMISSIONS_API = "/api/Permissions";

type ConfirmIntent = "switchRole" | "clearAll";

const PERMISSION_META: Record<
  number,
  { nombre: string; descripcion: string; grupo: string }
> = {
  1: {
    nombre: "Ver inicio",
    descripcion: "Accede al panel principal del sistema.",
    grupo: "Inicio",
  },
  2: {
    nombre: "Ver usuarios",
    descripcion: "Permite registrar y administrar usuarios.",
    grupo: "Usuarios y seguridad",
  },
  3: {
    nombre: "Registrar solicitud",
    descripcion: "Permite crear una nueva solicitud de adquisición.",
    grupo: "Adquisiciones",
  },
  4: {
    nombre: "Gestionar expediente",
    descripcion: "Permite ver y administrar documentos del expediente.",
    grupo: "Expediente",
  },
  5: {
    nombre: "Unidades administrativas",
    descripcion: "Permite visualizar y administrar unidades administrativas.",
    grupo: "Catálogos",
  },
  6: {
    nombre: "Roles",
    descripcion: "Permite visualizar y administrar roles del sistema.",
    grupo: "Usuarios y seguridad",
  },
  7: {
    nombre: "Permisos",
    descripcion: "Permite gestionar permisos del sistema.",
    grupo: "Usuarios y seguridad",
  },
  8: {
    nombre: "COG",
    descripcion: "Permite visualizar el catálogo COG.",
    grupo: "Catálogos",
  },
  9: {
    nombre: "Fondo de financiamiento",
    descripcion: "Permite administrar fondos de financiamiento.",
    grupo: "Catálogos",
  },
  10: {
    nombre: "Acciones de póliza",
    descripcion: "Permite visualizar el catálogo de acciones de póliza.",
    grupo: "Catálogos",
  },
  11: {
    nombre: "Comunidades",
    descripcion: "Permite administrar comunidades.",
    grupo: "Catálogos",
  },
  12: {
    nombre: "Beneficiarios",
    descripcion: "Permite administrar beneficiarios.",
    grupo: "Catálogos",
  },
  13: {
    nombre: "Proveedores",
    descripcion: "Permite administrar proveedores.",
    grupo: "Catálogos",
  },
  14: {
    nombre: "Programas",
    descripcion: "Permite administrar programas.",
    grupo: "Catálogos",
  },
  15: {
    nombre: "Proyectos",
    descripcion: "Permite administrar proyectos.",
    grupo: "Catálogos",
  },
  16: {
    nombre: "Clasificación de adquisiciones",
    descripcion: "Permite administrar la clasificación de adquisiciones.",
    grupo: "Catálogos",
  },
  17: {
    nombre: "Tipos de adquisición",
    descripcion: "Permite administrar tipos de adquisición.",
    grupo: "Catálogos",
  },
  18: {
    nombre: "Tipos de documento",
    descripcion: "Permite visualizar y gestionar tipos de documento.",
    grupo: "Catálogos",
  },
  19: {
    nombre: "Registrar adquisición",
    descripcion: "Permite registrar una nueva adquisición.",
    grupo: "Adquisiciones",
  },
  20: {
    nombre: "Consultar detalle",
    descripcion:
      "Permite consultar el detalle de una solicitud de adquisición.",
    grupo: "Adquisiciones",
  },
  21: {
    nombre: "Ver expediente",
    descripcion: "Permite acceder a la vista del expediente de la solicitud.",
    grupo: "Expediente",
  },
  22: {
    nombre: "Subir documentos masivos",
    descripcion:
      "Permite cargar varios documentos al expediente en una sola acción.",
    grupo: "Expediente",
  },
  23: {
    nombre: "Buscar documentos",
    descripcion: "Permite buscar documentos por nombre dentro del expediente.",
    grupo: "Expediente",
  },
  24: {
    nombre: "Consultar checklist",
    descripcion: "Permite consultar el checklist de documentos del expediente.",
    grupo: "Expediente",
  },
  25: {
    nombre: "Ver registro de adquisiciones",
    descripcion:
      "Permite acceder a la vista de registro de solicitudes de adquisición.",
    grupo: "Adquisiciones",
  },
  26: {
    nombre: "Pólizas de pago",
    descripcion:
      "Permite visualizar y gestionar el catálogo de pólizas de pago.",
    grupo: "Catálogos",
  },
  27: {
    nombre: "Notificaciones",
    descripcion: "Permite acceder a notificaciones en tiempo real e historial.",
    grupo: "Sistema",
  },
  28: {
    nombre: "Configuración del sistema",
    descripcion:
      "Permite visualizar y administrar la configuración del sistema.",
    grupo: "Sistema",
  },
  29: {
    nombre: "Agregar archivos",
    descripcion: "Permite agregar archivos al expediente de documentos.",
    grupo: "Expediente",
  },
  30: {
    nombre: "Aprobar documentos",
    descripcion: "Permite aprobar documentos del expediente.",
    grupo: "Expediente",
  },
  31: {
    nombre: "Denegar documentos",
    descripcion: "Permite denegar documentos del expediente.",
    grupo: "Expediente",
  },
  32: {
    nombre: "Eliminar documentos",
    descripcion: "Permite eliminar documentos del expediente.",
    grupo: "Expediente",
  },
};

export default function PermissionsByRole() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const selectedRoleId = useMemo(() => getRoleId(selectedRole), [selectedRole]);

  const [perms, setPerms] = useState<PermissionState[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [confirmIntent, setConfirmIntent] =
    useState<ConfirmIntent>("switchRole");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  useEffect(() => {
    void loadRoles();
  }, []);

  async function firstWorkingEndpoint(endpoints: string[]) {
    for (const url of endpoints) {
      const r = await requestJson(url, { method: "GET" });
      if (r.ok) return { url, data: r.data };
    }
    return { url: endpoints[0] ?? "", data: [] as unknown };
  }

  function extractList<T = unknown>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];

    if (isRecord(payload)) {
      const values = (payload as UnknownObject)["$values"];
      if (Array.isArray(values)) return values as T[];
    }

    const arr = findArrayDeep(payload, 0);
    if (arr) return arr as T[];

    if (isRecord(payload)) return [payload as T];
    return [];
  }

  function findArrayDeep(payload: unknown, depth: number): unknown[] | null {
    if (depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (!isRecord(payload)) return null;

    const obj = payload as UnknownObject;

    const values = obj["$values"];
    if (Array.isArray(values)) return values;

    const keys = [
      "data",
      "result",
      "items",
      "value",
      "values",
      "Items",
      "Data",
      "Result",
    ];

    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }

    return null;
  }

  async function loadRoles() {
    setRolesLoading(true);
    try {
      const token = readToken();
      if (!token) {
        showToast("error", "No hay token. Inicia sesión nuevamente.");
        setRoles([]);
        return;
      }

      const pick = await firstWorkingEndpoint(ROLES_ENDPOINTS);
      const list = extractList<Role>(pick.data);
      setRoles(list);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }

  function normalizePermissions(list: PermissionApi[]): PermissionState[] {
    const out: PermissionState[] = [];

    for (const p of list) {
      const id = Number(p.IdPermiso ?? p.idPermiso);
      if (!Number.isFinite(id) || id <= 0) continue;

      const moduloRaw = String(p.Modulo ?? p.modulo ?? "").trim() || "General";
      const accionRaw = String(p.Accion ?? p.accion ?? "").trim() || "Ver";
      const asignado = toBool(p.Asignado ?? p.asignado ?? false);

      const moduloNice = toNiceLabel(moduloRaw);
      const accionNice = toNiceLabel(accionRaw);
      const meta = PERMISSION_META[id];

      out.push({
        id,
        modulo: meta?.grupo ?? moduloNice,
        accion: accionNice,
        nombre: meta?.nombre ?? `${moduloNice} ${accionNice}`,
        descripcion: meta?.descripcion ?? "Sin descripción disponible.",
        asignado,
      });
    }

    out.sort((a, b) => {
      if (a.asignado !== b.asignado) return a.asignado ? -1 : 1;

      const g = a.modulo.localeCompare(b.modulo);
      if (g !== 0) return g;

      const n = a.nombre.localeCompare(b.nombre);
      if (n !== 0) return n;

      return a.id - b.id;
    });

    return out;
  }

  async function loadPermissionsByRole(idRol: number) {
    setPermsLoading(true);
    try {
      const result = await requestJson(`${PERMISSIONS_API}/${idRol}`, {
        method: "GET",
      });

      if (!result.ok) {
        showToast("error", `Permisos (${result.status}): ${result.error}`);
        setPerms([]);
        setMode("view");
        setDirty(false);
        return;
      }

      const list = extractList<PermissionApi>(result.data);
      setPerms(normalizePermissions(list));
      setMode("view");
      setDirty(false);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setPerms([]);
      setMode("view");
      setDirty(false);
    } finally {
      setPermsLoading(false);
    }
  }

  function clearAllSelectionImmediate() {
    setConfirmOpen(false);
    setPendingRole(null);
    setMode("view");
    setDirty(false);
    setRoleSearch("");
    setModuleSearch("");
    setSelectedRole(null);
    setPerms([]);
  }

  function requestClearAllSelection() {
    if (dirty) {
      setConfirmIntent("clearAll");
      setConfirmOpen(true);
      return;
    }
    clearAllSelectionImmediate();
  }

  function requestSelectRole(r: Role) {
    const id = getRoleId(r);
    if (id == null) return;

    if (dirty) {
      setConfirmIntent("switchRole");
      setPendingRole(r);
      setConfirmOpen(true);
      return;
    }

    setSelectedRole(r);
    void loadPermissionsByRole(id);
  }

  async function onConfirmProceed() {
    setConfirmOpen(false);

    if (confirmIntent === "clearAll") {
      clearAllSelectionImmediate();
      return;
    }

    const next = pendingRole;
    setPendingRole(null);
    if (!next) return;

    const id = getRoleId(next);
    if (id == null) return;

    setSelectedRole(next);
    await loadPermissionsByRole(id);
  }

  function startEdit() {
    if (!selectedRoleId) return;
    setMode("edit");
  }

  function cancelEdit() {
    if (!selectedRoleId) return;
    setMode("view");
    setDirty(false);
    void loadPermissionsByRole(selectedRoleId);
  }

  function togglePermission(idPermiso: number, next: boolean) {
    if (mode !== "edit" || saving) return;

    setPerms((prev) =>
      prev.map((p) => (p.id === idPermiso ? { ...p, asignado: next } : p)),
    );
    setDirty(true);
  }

  async function onSave() {
    if (!selectedRoleId) {
      showToast("error", "Selecciona un rol.");
      return;
    }

    setSaving(true);
    try {
      const permisosIds = perms.filter((p) => p.asignado).map((p) => p.id);
      const payload: Record<string, unknown> = {
        IdRol: selectedRoleId,
        Permisos: permisosIds,
      };

      const result = await requestJson(`${PERMISSIONS_API}/update`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        showToast("error", `Guardar (${result.status}): ${result.error}`);
        return;
      }

      showToast("success", "Permisos actualizados correctamente");
      setDirty(false);
      setMode("view");
      await loadPermissionsByRole(selectedRoleId);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      (getRoleName(r) ?? "").toLowerCase().includes(q),
    );
  }, [roles, roleSearch]);

  const filteredPerms = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return perms;

    return perms.filter((p) => {
      return (
        p.modulo.toLowerCase().includes(q) ||
        p.accion.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q)
      );
    });
  }, [perms, moduleSearch]);

  const visiblePerms = useMemo(() => filteredPerms, [filteredPerms]);

  const isEdit = mode === "edit";

  return (
    <div className={styles.page}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar. Si continúas, se perderán. ¿Deseas continuar?"
        confirmText="Sí, continuar"
        cancelText="Cancelar"
        loading={saving}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingRole(null);
        }}
        onConfirm={onConfirmProceed}
      />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Permisos</h1>
            <p className={styles.sub}>
              Selecciona un rol y asigna permisos por módulo y acción.
            </p>
          </div>

          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Buscar permiso, módulo o descripción…"
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              disabled={!selectedRoleId || saving || permsLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />

            {moduleSearch.trim() !== "" && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setModuleSearch("")}
                type="button"
                aria-label="Limpiar búsqueda"
                disabled={!selectedRoleId || saving || permsLoading}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Roles</p>
          </div>

          <div style={{ padding: 14 }}>
            <div className={styles.searchWrapper}>
              <div className={styles.searchIcon} aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>

              <input
                className={styles.searchInput}
                placeholder="Buscar rol por nombre…"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                disabled={saving || rolesLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />

              {roleSearch.trim() !== "" && (
                <button
                  className={styles.clearSearchBtn}
                  onClick={() => setRoleSearch("")}
                  type="button"
                  aria-label="Limpiar búsqueda"
                  disabled={saving || rolesLoading}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: 140 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {rolesLoading ? (
                  <tr>
                    <td colSpan={2} className={styles.empty}>
                      Cargando roles...
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.empty}>
                      No se encontraron roles.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r, idx) => {
                    const id = getRoleId(r);
                    const name = getRoleName(r) ?? "—";
                    const active = getRoleActive(r) ?? false;

                    const key = id != null ? `${id}-${idx}` : `role-${idx}`;
                    const isSelected =
                      selectedRoleId != null &&
                      id != null &&
                      id === selectedRoleId;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => requestSelectRole(r)}
                        title="Seleccionar rol"
                      >
                        <td>{name}</td>
                        <td>
                          <Switch checked={active} disabled />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>
              {isEdit ? "Editar permisos" : "Permisos"}
            </p>
          </div>

          <div className={styles.panelBody}>
            {!selectedRoleId ? (
              <div className={styles.helper}>
                Selecciona un rol para ver permisos.
              </div>
            ) : permsLoading ? (
              <div className={styles.helper}>Cargando permisos...</div>
            ) : perms.length === 0 ? (
              <div className={styles.helper}>No hay permisos para mostrar.</div>
            ) : (
              <>
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Rol</span>
                    <span className={styles.detailValue}>
                      {getRoleName(selectedRole) ?? "—"}
                    </span>
                  </div>
                </div>

                <div className={styles.permsScroll}>
                  {visiblePerms.length === 0 ? (
                    <div className={styles.helper}>
                      No se encontraron permisos.
                    </div>
                  ) : (
                    visiblePerms.map((p) => (
                      <div key={p.id} className={styles.permissionCard}>
                        <div className={styles.permissionInfo}>
                          <div className={styles.permissionDescOnly}>
                            {p.descripcion}
                          </div>
                        </div>

                        <Switch
                          checked={p.asignado}
                          onChange={(next) => togglePermission(p.id, next)}
                          disabled={!isEdit || saving}
                          label={p.asignado ? "Sí" : "No"}
                        />
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.actions}>
                  {!isEdit ? (
                    <>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={startEdit}
                        disabled={!selectedRoleId || permsLoading || saving}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={requestClearAllSelection}
                        disabled={saving}
                        title="Quitar selección de rol y limpiar permisos"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className={styles.btnSave}
                        onClick={() => void onSave()}
                        disabled={saving || !dirty}
                      >
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <label className={styles.switchWrap} aria-disabled={disabled}>
      {label && <span className={styles.switchLabel}>{label}</span>}
      <button
        type="button"
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => !disabled && onChange?.(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={label ?? "Cambiar estado"}
      >
        <span className={styles.switchKnob} />
      </button>
    </label>
  );
}

function getRoleId(r: Role | null): number | null {
  if (!r) return null;
  const v = r.idRol ?? r.IdRol ?? r.id ?? r.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getRoleName(r: Role | null): string | null {
  if (!r) return null;
  const v =
    r.rolName ?? r.RolName ?? r.roleName ?? r.RoleName ?? r.name ?? r.Name;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getRoleActive(r: Role | null): boolean | null {
  if (!r) return null;
  const v: unknown = r.active ?? r.Active ?? r.isActive ?? r.IsActive;
  return toBoolOrNull(v);
}

function toNiceLabel(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "—";

  const last = raw.split(/[/\\]/).filter(Boolean).pop() ?? raw;

  const last2 =
    last
      .split(/[>|-]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .pop() ?? last;

  const last3 = last2.split(".").pop() ?? last2;

  const clean = last3.replace(/[_-]+/g, " ").trim();
  return toTitle(clean);
}

function toTitle(s: string): string {
  const t = s.trim();
  if (!t) return "—";

  return t
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return Boolean(v);
}

function toBoolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return null;
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