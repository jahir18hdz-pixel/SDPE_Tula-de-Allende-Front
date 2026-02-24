import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/Permissions.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import ConfirmDialog from "../../../Components/layout/ConfirmDialog";

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
  asignado: boolean;
};

type AuthStored = { token?: string; Token?: string };
type UnknownRecord = Record<string, unknown>;
type UnknownObject = Record<string, unknown>;

const BASE_API = "https://localhost:7197";
const PERMISSIONS_API = `${BASE_API}/api/Permissions`;

const ROLES_ENDPOINTS = [
  `${BASE_API}/api/Role`,
  `${BASE_API}/api/role`,
  `${BASE_API}/api/Roles`,
  `${BASE_API}/api/roles`,
  `${BASE_API}/api/Roles/all`,
  `${BASE_API}/api/roles/all`,
];

type ConfirmIntent = "switchRole" | "clearAll";

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
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent>("switchRole");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========= Auth / Request =========
  function readToken(): string {
    const rawAuth = localStorage.getItem("auth");
    if (rawAuth) {
      try {
        const parsed = JSON.parse(rawAuth) as AuthStored;
        const token = (parsed.token ?? parsed.Token ?? "").trim();
        if (token) return token;
      } catch {
        // ignore
      }
    }
    return "";
  }

  function authHeaders(): HeadersInit {
    const token = readToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function requestJson(
    url: string,
    init?: RequestInit
  ): Promise<
    | { ok: true; data: unknown; status: number }
    | { ok: false; error: string; status: number }
  > {
    const res = await fetch(url, { ...init, credentials: "omit" });

    if (res.status === 204) return { ok: true, data: [], status: 204 };

    const text = await safeText(res);
    const parsed = tryParseJson(text);

    if (!res.ok) {
      const apiMsg = pickFirstString(parsed, ["message", "title", "detail"]) ?? "";
      const msg =
        apiMsg ||
        (typeof parsed === "string" ? parsed : "") ||
        text ||
        `HTTP ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: parsed, status: res.status };
  }

  async function firstWorkingEndpoint(endpoints: string[]) {
    const headers = authHeaders();
    for (const url of endpoints) {
      const r = await requestJson(url, { method: "GET", headers });
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

    const keys = ["data", "result", "items", "value", "values", "Items", "Data", "Result"];
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
      const nested = findArrayDeep(v, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  // ========= Loaders =========
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

      // ✅ mostrar solo nombre (sin /rutas ni separadores raros) y bonito
      const modulo = toNiceLabel(moduloRaw);
      const accion = toNiceLabel(accionRaw);

      out.push({ id, modulo, accion, asignado });
    }

    // ✅ ORDEN: primero asignados, luego no asignados; luego por modulo/accion/id
    out.sort((a, b) => {
      if (a.asignado !== b.asignado) return a.asignado ? -1 : 1;
      const m = a.modulo.localeCompare(b.modulo);
      if (m !== 0) return m;
      const ac = a.accion.localeCompare(b.accion);
      if (ac !== 0) return ac;
      return a.id - b.id;
    });

    return out;
  }

  async function loadPermissionsByRole(idRol: number) {
    setPermsLoading(true);
    try {
      const result = await requestJson(`${PERMISSIONS_API}/${idRol}`, {
        method: "GET",
        headers: authHeaders(),
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

  // ========= limpiar =========
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

  // ========= UI: selección rol =========
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
    setPerms((prev) => prev.map((p) => (p.id === idPermiso ? { ...p, asignado: next } : p)));
    setDirty(true);
  }

  async function onSave() {
    if (!selectedRoleId) return showToast("error", "Selecciona un rol.");

    setSaving(true);
    try {
      const permisosIds = perms.filter((p) => p.asignado).map((p) => p.id);
      const payload: Record<string, unknown> = { IdRol: selectedRoleId, Permisos: permisosIds };

      const result = await requestJson(`${PERMISSIONS_API}/update`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", `Guardar (${result.status}): ${result.error}`);

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

  // ========= Derived =========

  // ✅ Roles: filtrar solo por NOMBRE (sin id)
  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => (getRoleName(r) ?? "").toLowerCase().includes(q));
  }, [roles, roleSearch]);

  // ✅ Permisos: filtrar por modulo/accion (sin id) y mantener orden de asignados primero
  const filteredPerms = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return perms;

    return perms.filter((p) => {
      return p.modulo.toLowerCase().includes(q) || p.accion.toLowerCase().includes(q);
    });
  }, [perms, moduleSearch]);

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
            <p className={styles.sub}>Selecciona un rol y asigna permisos por módulo y acción.</p>
          </div>

          <div className={styles.searchWrapper}>
            <div className={styles.searchIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Buscar módulo o acción…"
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* LEFT: roles */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Roles</p>
          </div>

          <div style={{ padding: 14 }}>
            <div className={styles.searchWrapper}>
              <div className={styles.searchIcon} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  {/* ✅ no mostrar id */}
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
                    const isSelected = selectedRoleId != null && id != null && id === selectedRoleId;

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

        {/* RIGHT: permisos */}
        <aside className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>{isEdit ? "Editar permisos" : "Permisos"}</p>
          </div>

          <div className={styles.panelBody}>
            {!selectedRoleId ? (
              <div className={styles.helper}>Selecciona un rol para ver permisos.</div>
            ) : permsLoading ? (
              <div className={styles.helper}>Cargando permisos...</div>
            ) : perms.length === 0 ? (
              <div className={styles.helper}>No hay permisos para mostrar.</div>
            ) : (
              <>
                <div className={styles.detailBox}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Rol</span>
                    <span className={styles.detailValue}>{getRoleName(selectedRole) ?? "—"}</span>
                  </div>
                </div>

                <div className={styles.permsScroll}>
                  {filteredPerms.length === 0 ? (
                    <div className={styles.helper}>No se encontraron permisos.</div>
                  ) : (
                    filteredPerms.map((p) => (
                      <div key={p.id} className={styles.actionRow}>
                        <div className={styles.actionLeft}>
                          {/* ✅ solo nombre del modulo (sin /ruta) */}
                          <div className={styles.actionName}>
                            {p.modulo} — {p.accion}
                          </div>
                          {/* ✅ ocultar id */}
                          {/* <div className={styles.actionId}>#{p.id}</div> */}
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
                        Limpiar
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.btnGhost} onClick={cancelEdit} disabled={saving}>
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={requestClearAllSelection}
                        disabled={saving}
                        title="Quitar selección de rol y limpiar permisos"
                      >
                        Limpiar
                      </button>

                      <button type="button" className={styles.btnSave} onClick={() => void onSave()} disabled={saving || !dirty}>
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

/** Switch */
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

/** Helpers */
function getRoleId(r: Role | null): number | null {
  if (!r) return null;
  const v = r.idRol ?? r.IdRol ?? r.id ?? r.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getRoleName(r: Role | null): string | null {
  if (!r) return null;
  const v = r.rolName ?? r.RolName ?? r.roleName ?? r.RoleName ?? r.name ?? r.Name;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getRoleActive(r: Role | null): boolean | null {
  if (!r) return null;
  const v: unknown = r.active ?? r.Active ?? r.isActive ?? r.IsActive;
  return toBoolOrNull(v);
}

function toNiceLabel(input: string): string {
  // /home -> home ; permisos.view -> view ; "HOME" -> "Home"
  const raw = (input ?? "").trim();
  if (!raw) return "—";

  const last = raw
    .split(/[/\\]/) // rutas
    .filter(Boolean)
    .pop() ?? raw;

  const last2 = last
    .split(/[>|-]/) // separadores raros
    .map((s) => s.trim())
    .filter(Boolean)
    .pop() ?? last;

  const last3 = last2
    .split(".") // namespaces tipo Modulo.Accion
    .pop() ?? last2;

  const clean = last3.replace(/[_-]+/g, " ").trim();
  return toTitle(clean);
}

function toTitle(s: string): string {
  const t = s.trim();
  if (!t) return "—";
  // Title Case simple (Home, View, etc.)
  return t
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  const t = (text ?? "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return text;
  }
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function pickFirstString(payload: unknown, keys: string[]): string | null {
  if (!isRecord(payload)) return null;
  const obj = payload as UnknownObject;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
  }
  return null;
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
