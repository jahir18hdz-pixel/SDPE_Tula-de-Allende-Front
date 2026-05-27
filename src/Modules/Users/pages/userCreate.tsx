import  { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/UserCreate.module.css";
import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type UserRow = {
  idUser?: number;
  IdUser?: number;
  id?: number;
  Id?: number;

  email?: string;
  Email?: string;

  role?: string;
  Role?: string;
  idRole?: number;
  IdRole?: number;

  administrativeUnit?: string;
  AdministrativeUnit?: string;
  idAdministrativeUnit?: number;
  IdAdministrativeUnit?: number;

  asset?: boolean | number | string;
  Asset?: boolean | number | string;

  [key: string]: unknown;
};

type PagedLike = {
  items?: UserRow[];
  Items?: UserRow[];
  data?: UserRow[];
  Data?: UserRow[];
  users?: UserRow[];
  Users?: UserRow[];
  totalCount?: number;
  TotalCount?: number;
  total?: number;
  Total?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
};

type CreateForm = {
  email: string;
  password: string;
  password2: string;
  idAdministrativeUnit: string;
  idRole: string;
};

type EditForm = {
  email: string;
  idAdministrativeUnit: string;
  idRole: string;
  asset: boolean;
};

type UnknownRecord = Record<string, unknown>;
type UnknownObject = Record<string, unknown>;

type RoleOption = { id: number; name: string; active?: boolean };
type AuOption = { id: number; name: string; active?: boolean };

const USERS_BASE = "/api/users";

const ROLE_ENDPOINTS = [
  "/api/Roles",
  "/api/roles",
  "/api/Role",
  "/api/role",
  "/api/Roles/all",
  "/api/roles/all",
  "/api/Roles/get-all",
  "/api/roles/get-all",
];

const AU_ENDPOINTS = [
  "/api/AdministrativeUnit",
  "/api/administrativeunit",
  "/api/AdministrativeUnits",
  "/api/administrativeunits",
];

const initialCreate: CreateForm = {
  email: "",
  password: "",
  password2: "",
  idAdministrativeUnit: "",
  idRole: "",
};

const initialEdit: EditForm = {
  email: "",
  idAdministrativeUnit: "",
  idRole: "",
  asset: true,
};

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [adminUnits, setAdminUnits] = useState<AuOption[]>([]);
  const [loadingCombos, setLoadingCombos] = useState(false);

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [create, setCreate] = useState<CreateForm>(initialCreate);
  const [edit, setEdit] = useState<EditForm>(initialEdit);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  const selectedId = useMemo(() => getId(selected), [selected]);

  useEffect(() => {
    void loadPaged(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "create" || mode === "edit") {
      void loadCombos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function firstWorkingEndpoint(endpoints: string[]) {
    for (const path of endpoints) {
      const r = await requestJson(path, {
        method: "GET",
        headers: authHeaders(),
      });
      if (r.ok) return { path, data: r.data as unknown };
    }
    return { path: endpoints[0] ?? "", data: [] as unknown };
  }

  function normalizePaged(payload: unknown): {
    items: UserRow[];
    totalCount: number | null;
    page: number | null;
    pageSize: number | null;
  } {
    if (Array.isArray(payload)) {
      return {
        items: payload as UserRow[],
        totalCount: null,
        page: null,
        pageSize: null,
      };
    }

    const p = (payload ?? {}) as PagedLike;

    const items =
      (p.items ??
        p.Items ??
        p.data ??
        p.Data ??
        p.users ??
        p.Users ??
        []) as UserRow[];

    const totalCount =
      (p.totalCount ?? p.TotalCount ?? p.total ?? p.Total) != null
        ? Number(p.totalCount ?? p.TotalCount ?? p.total ?? p.Total)
        : null;

    const page = (p.page ?? p.Page) != null ? Number(p.page ?? p.Page) : null;
    const pageSize =
      (p.pageSize ?? p.PageSize) != null
        ? Number(p.pageSize ?? p.PageSize)
        : null;

    return { items, totalCount, page, pageSize };
  }

  async function loadPaged(nextPage: number, nextPageSize: number) {
    setLoading(true);
    try {
      const result = await requestJson(
        `${USERS_BASE}/paged?page=${nextPage}&pageSize=${nextPageSize}`,
        { method: "GET", headers: authHeaders() }
      );

      if (!result.ok) {
        showToast("error", result.error);
        setRows([]);
        return;
      }

      const norm = normalizePaged(result.data);
      setRows(norm.items);
      setTotalCount(norm.totalCount);

      setPage(norm.page ?? nextPage);
      setPageSize(norm.pageSize ?? nextPageSize);

      if (selectedId != null) {
        const found = norm.items.find((u) => getId(u) === selectedId) ?? null;
        setSelected(found);
      }
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    setLoadingCombos(true);
    try {
      const [rolesPick, auPick] = await Promise.all([
        firstWorkingEndpoint(ROLE_ENDPOINTS),
        firstWorkingEndpoint(AU_ENDPOINTS),
      ]);

      const rolesNorm = normalizeRoles(rolesPick.data);
      const auNorm = normalizeAUs(auPick.data);

      setRoles(rolesNorm);
      setAdminUnits(auNorm);

      if (rolesNorm.length === 0) {
        showToast(
          "error",
          "No se pudieron cargar Roles. Revisa ROLE_ENDPOINTS (y CORS/HTTPS)."
        );
      }

      if (auNorm.length === 0) {
        showToast(
          "error",
          "No se pudieron cargar Unidades. Revisa AU_ENDPOINTS."
        );
      }
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
      setRoles([]);
      setAdminUnits([]);
    } finally {
      setLoadingCombos(false);
    }
  }

  function normalizeRoles(payload: unknown): RoleOption[] {
    const arr = pickArray(payload, [
      "items",
      "Items",
      "data",
      "Data",
      "roles",
      "Roles",
    ]);

    return arr
      .map((row): RoleOption | null => {
        const obj = asObject(row);
        if (!obj) return null;

        const id = readNumber(obj, ["idRol", "IdRol", "id", "Id"], 0);
        if (!Number.isFinite(id) || id <= 0) return null;

        const name = readString(
          obj,
          ["rolName", "RolName", "roleName", "RoleName", "name", "Name"],
          `Rol ${id}`
        );

        const active = readBool(obj, [
          "active",
          "Active",
          "isActive",
          "IsActive",
        ]);

        return { id, name, active };
      })
      .filter((x): x is RoleOption => x !== null);
  }

  function normalizeAUs(payload: unknown): AuOption[] {
    const arr = pickArray(payload, ["items", "Items", "data", "Data"]);

    return arr
      .map((row): AuOption | null => {
        const obj = asObject(row);
        if (!obj) return null;

        const id = readNumber(
          obj,
          [
            "idAdministrativeUnit",
            "IdAdministrativeUnit",
            "administrativeUnitId",
            "AdministrativeUnitId",
            "id",
            "Id",
            "code",
            "Code",
          ],
          0
        );
        if (!Number.isFinite(id) || id <= 0) return null;

        const name = readString(
          obj,
          [
            "description",
            "Description",
            "descripcion",
            "Descripcion",
            "name",
            "Name",
            "administrativeUnit",
            "AdministrativeUnit",
          ],
          `Unidad ${id}`
        );

        const active = readBool(obj, [
          "active",
          "Active",
          "isActive",
          "IsActive",
        ]);

        return { id, name, active };
      })
      .filter((x): x is AuOption => x !== null);
  }

  const displayedRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = q
      ? rows
      : rows.filter((u) => {
          const active = getAsset(u) ?? false;
          return showInactive ? !active : active;
        });

    if (!q) return base;

    return base.filter((u) => {
      const email = (getEmail(u) ?? "").toLowerCase();
      const role = (getRole(u) ?? "").toLowerCase();
      const au = (getAdministrativeUnit(u) ?? "").toLowerCase();
      return email.includes(q) || role.includes(q) || au.includes(q);
    });
  }, [rows, search, showInactive]);

  const totalPages = useMemo(() => {
    if (totalCount == null) return null;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  const formDisabled = saving || loading || loadingCombos;

  function onRowClick(row: UserRow) {
    setSelected(row);
    setMode("view");
  }

  function startCreate() {
    setMode("create");
    setSelected(null);
    setCreate(initialCreate);
  }

  function clearSelection() {
    setSelected(null);
    setMode("view");
    setEdit(initialEdit);
  }

  async function startEdit() {
    if (!selected) return;

    if (roles.length === 0 || adminUnits.length === 0) {
      await loadCombos();
    }

    setEdit({
      email: getEmail(selected) ?? "",
      idRole: String(getRoleId(selected) ?? ""),
      idAdministrativeUnit: String(getAdministrativeUnitId(selected) ?? ""),
      asset: getAsset(selected) ?? true,
    });

    setMode("edit");
  }

  function toggleViewActiveInactive() {
    setShowInactive((prev) => !prev);
    setSelected(null);
    setMode("view");
    setSearch("");
  }

  function validateCreate(): string {
    const email = create.email.trim().toLowerCase();
    if (!email) return "El correo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Correo inválido.";
    if (!create.password) return "La contraseña es obligatoria.";
    if (create.password.length < 8) return "Mínimo 8 caracteres.";
    if (create.password !== create.password2)
      return "Las contraseñas no coinciden.";
    if (!create.idAdministrativeUnit.trim())
      return "Unidad administrativa es obligatoria.";
    if (!create.idRole.trim()) return "Rol es obligatorio.";

    const au = Number(create.idAdministrativeUnit);
    const r = Number(create.idRole);

    if (!Number.isFinite(au) || au <= 0)
      return "Unidad administrativa inválida.";
    if (!Number.isFinite(r) || r <= 0) return "Rol inválido.";

    return "";
  }

  function validateEdit(): string {
    const email = edit.email.trim().toLowerCase();
    if (!email) return "El correo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Correo inválido.";

    if (!edit.idRole.trim()) return "Rol obligatorio.";
    if (!edit.idAdministrativeUnit.trim())
      return "Unidad administrativa obligatoria.";

    const roleId = Number(edit.idRole);
    const auId = Number(edit.idAdministrativeUnit);

    if (!Number.isFinite(roleId) || roleId <= 0) return "Rol inválido.";
    if (!Number.isFinite(auId) || auId <= 0)
      return "Unidad administrativa inválida.";

    return "";
  }

  async function onCreate() {
    const msg = validateCreate();
    if (msg) return showToast("error", msg);

    setSaving(true);
    try {
      const payload = {
        Email: create.email.trim().toLowerCase(),
        Password: create.password,
        IdAdministrativeUnit: Number(create.idAdministrativeUnit),
        IdRole: Number(create.idRole),

        email: create.email.trim().toLowerCase(),
        password: create.password,
        idAdministrativeUnit: Number(create.idAdministrativeUnit),
        idRole: Number(create.idRole),
      };

      const result = await requestJson(USERS_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!result.ok) return showToast("error", result.error);

      showToast("success", "Usuario creado correctamente");
      setMode("view");
      setCreate(initialCreate);
      await loadPaged(1, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function updateUserDataOnly(): Promise<void> {
    const id = getId(selected);
    if (id == null) throw new Error("No pude identificar el usuario.");

    const payload = {
      IdUser: id,
      Email: edit.email.trim().toLowerCase(),
      IdRole: Number(edit.idRole),
      IdAdministrativeUnit: Number(edit.idAdministrativeUnit),

      idUser: id,
      email: edit.email.trim().toLowerCase(),
      idRole: Number(edit.idRole),
      idAdministrativeUnit: Number(edit.idAdministrativeUnit),
    };

    const result = await requestJson(`${USERS_BASE}/update`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      throw new Error(result.error);
    }
  }

  async function updateUserStatusOnly(next: boolean): Promise<void> {
    const id = getId(selected);
    if (id == null) throw new Error("No pude identificar el usuario.");

    const payload = {
      idUser: id,
      asset: next,
      IdUser: id,
      Asset: next,
      active: next,
      Active: next,
    };

    const result = await requestJson(`${USERS_BASE}/change-status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      throw new Error(result.error);
    }
  }

  function didUserDataChange(): boolean {
    if (!selected) return false;

    const originalEmail = (getEmail(selected) ?? "").trim().toLowerCase();
    const nextEmail = edit.email.trim().toLowerCase();

    const originalRoleId = getRoleId(selected);
    const originalAuId = getAdministrativeUnitId(selected);

    const nextRoleId = Number(edit.idRole);
    const nextAuId = Number(edit.idAdministrativeUnit);

    return (
      originalEmail !== nextEmail ||
      originalRoleId !== nextRoleId ||
      originalAuId !== nextAuId
    );
  }

  async function onSaveEdit() {
    if (!selected) return;

    const msg = validateEdit();
    if (msg) {
      showToast("error", msg);
      return;
    }

    const originalStatus = getAsset(selected) ?? true;
    const statusChanged = edit.asset !== originalStatus;
    const dataChanged = didUserDataChange();

    if (!dataChanged && !statusChanged) {
      showToast("error", "No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    try {
      if (dataChanged) {
        await updateUserDataOnly();
      }

      if (statusChanged) {
        await updateUserStatusOnly(edit.asset);
      }

      showToast("success", "Usuario actualizado correctamente");
      setMode("view");
      setSelected(null);
      setEdit(initialEdit);
      await loadPaged(page, pageSize);
    } catch (e: unknown) {
      showToast("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Usuarios</h1>
            <p className={styles.sub}>
              {search.trim()
                ? "Buscando en usuarios activos e inactivos."
                : showInactive
                  ? "Viendo usuarios inactivos."
                  : "Viendo usuarios activos."}
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
              placeholder="Buscar por correo, rol o unidad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={saving || loading}
            />

            {search.trim() !== "" && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                type="button"
                aria-label="Limpiar búsqueda"
                disabled={saving || loading}
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

          <div className={styles.headerActions}>
            <button
              className={styles.btnGhost}
              type="button"
              onClick={toggleViewActiveInactive}
              disabled={saving || loading || mode === "create" || mode === "edit"}
              title="Cambiar vista activos/inactivos"
            >
              {showInactive ? "Ver activos" : "Ver inactivos"}
            </button>

            <button
              className={styles.btnPrimary}
              onClick={startCreate}
              disabled={saving || mode === "create"}
              type="button"
            >
              {mode === "create" ? "Creando..." : "+ Nuevo"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <p className={styles.cardTitle}>Listado</p>

            <div className={styles.pager}>
              <select
                className={styles.pageSize}
                value={pageSize}
                disabled={loading || saving}
                onChange={(e) => {
                  const ps = Number(e.target.value);
                  void loadPaged(1, ps);
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / pág
                  </option>
                ))}
              </select>

              <div className={styles.pagerBtns}>
                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={loading || saving || page <= 1}
                  onClick={() => void loadPaged(Math.max(1, page - 1), pageSize)}
                >
                  Anterior
                </button>

                <span className={styles.pagerInfo}>
                  {page}
                  {totalPages ? ` / ${totalPages}` : ""}
                </span>

                <button
                  className={styles.pagerBtn}
                  type="button"
                  disabled={
                    loading ||
                    saving ||
                    (totalPages != null ? page >= totalPages : rows.length < pageSize)
                  }
                  onClick={() => void loadPaged(page + 1, pageSize)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Unidad Adm.</th>
                  <th style={{ width: 170 }}>Activo</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      {search.trim()
                        ? "No se encontraron usuarios con esos criterios."
                        : showInactive
                          ? "No hay usuarios inactivos."
                          : "No hay usuarios activos."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((u, idx) => {
                    const id = getId(u);
                    const key = id != null ? String(id) : `row-${idx}`;
                    const isSelected =
                      selectedId != null && id != null && id === selectedId;
                    const asset = getAsset(u) ?? false;

                    return (
                      <tr
                        key={key}
                        className={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => onRowClick(u)}
                      >
                        <td className={styles.mono}>{getEmail(u) ?? "—"}</td>
                        <td>{getRole(u) ?? "—"}</td>
                        <td>{getAdministrativeUnit(u) ?? "—"}</td>
                        <td>
                          <Switch
                            checked={asset}
                            disabled
                            label={asset ? "Activo" : "Inactivo"}
                          />
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
              {mode === "create"
                ? "Nuevo usuario"
                : mode === "edit"
                  ? "Editar usuario"
                  : "Detalle"}
            </p>
          </div>

          <div className={styles.panelBody}>
            {mode === "create" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onCreate();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailCard}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Correo</span>
                      <input
                        className={styles.floatingInput}
                        value={create.email}
                        onChange={(e) =>
                          setCreate((p) => ({ ...p, email: e.target.value }))
                        }
                        disabled={formDisabled}
                        placeholder="correo@dominio.com"
                      />
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Rol</span>
                      <select
                        className={styles.floatingSelect}
                        value={create.idRole}
                        onChange={(e) =>
                          setCreate((p) => ({ ...p, idRole: e.target.value }))
                        }
                        disabled={formDisabled}
                      >
                        <option value="">Selecciona un rol...</option>
                        {roles.map((r) => (
                          <option key={r.id} value={String(r.id)}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Unidad administrativa
                      </span>
                      <select
                        className={styles.floatingSelect}
                        value={create.idAdministrativeUnit}
                        onChange={(e) =>
                          setCreate((p) => ({
                            ...p,
                            idAdministrativeUnit: e.target.value,
                          }))
                        }
                        disabled={formDisabled}
                      >
                        <option value="">Selecciona una unidad...</option>
                        {adminUnits.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Contraseña</span>
                      <input
                        type="password"
                        className={styles.floatingInput}
                        value={create.password}
                        onChange={(e) =>
                          setCreate((p) => ({ ...p, password: e.target.value }))
                        }
                        disabled={formDisabled}
                        placeholder="********"
                      />
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Confirmar contraseña
                      </span>
                      <input
                        type="password"
                        className={styles.floatingInput}
                        value={create.password2}
                        onChange={(e) =>
                          setCreate((p) => ({ ...p, password2: e.target.value }))
                        }
                        disabled={formDisabled}
                        placeholder="********"
                      />
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={saving}
                    >
                      Cancelar
                    </button>

                   

                    <button
                      type="submit"
                      className={styles.btnSave}
                      disabled={formDisabled}
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </form>
            ) : !selected ? (
              <div className={styles.helper}>
                Selecciona un usuario de la tabla para ver detalles.
              </div>
            ) : mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSaveEdit();
                }}
              >
                <div className={styles.detailBox}>
                  <div className={styles.detailCard}>
                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Correo</span>
                      <input
                        className={styles.floatingInput}
                        value={edit.email}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, email: e.target.value }))
                        }
                        disabled={formDisabled}
                        placeholder="correo@dominio.com"
                      />
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>Rol</span>
                      <select
                        className={styles.floatingSelect}
                        value={edit.idRole}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, idRole: e.target.value }))
                        }
                        disabled={formDisabled}
                      >
                        <option value="">Selecciona un rol...</option>
                        {roles.map((r) => (
                          <option key={r.id} value={String(r.id)}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.floatingField}>
                      <span className={styles.floatingLabel}>
                        Unidad administrativa
                      </span>
                      <select
                        className={styles.floatingSelect}
                        value={edit.idAdministrativeUnit}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            idAdministrativeUnit: e.target.value,
                          }))
                        }
                        disabled={formDisabled}
                      >
                        <option value="">Selecciona una unidad...</option>
                        {adminUnits.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Activo</span>
                      <Switch
                        checked={edit.asset}
                        disabled={formDisabled}
                        label={edit.asset ? "Activo" : "Inactivo"}
                        onChange={(next) =>
                          setEdit((p) => ({ ...p, asset: next }))
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setMode("view")}
                      disabled={saving}
                    >
                      Cancelar
                    </button>


                    <button
                      type="submit"
                      className={styles.btnSave}
                      disabled={saving}
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className={styles.detailBox}>
                <div className={styles.detailCard}>
                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Correo</span>
                    <div className={styles.floatingValue}>
                      {getEmail(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>Rol</span>
                    <div className={styles.floatingValue}>
                      {getRole(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.floatingField}>
                    <span className={styles.floatingLabel}>
                      Unidad administrativa
                    </span>
                    <div className={styles.floatingValue}>
                      {getAdministrativeUnit(selected) ?? "—"}
                    </div>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Activo</span>
                    <Switch
                      checked={getAsset(selected) ?? false}
                      disabled
                      label={(getAsset(selected) ?? false) ? "Activo" : "Inactivo"}
                    />
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.btnGhost}
                    type="button"
                    onClick={clearSelection}
                    disabled={saving}
                  >
                    Cerrar
                  </button>

                  <button
                    className={styles.btnEdit}
                    type="button"
                    onClick={() => void startEdit()}
                    disabled={saving || loading}
                  >
                    Editar
                  </button>
                </div>
              </div>
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
        aria-label={label ?? "Estado"}
      >
        <span className={styles.switchKnob} />
      </button>
    </label>
  );
}

/** Helpers */
function getId(u: UserRow | null): number | null {
  if (!u) return null;
  const v = u.idUser ?? u.IdUser ?? u.id ?? u.Id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getEmail(u: UserRow | null): string | null {
  if (!u) return null;
  const s = String(u.email ?? u.Email ?? "").trim();
  return s ? s : null;
}

function getRole(u: UserRow | null): string | null {
  if (!u) return null;
  const s = String(u.role ?? u.Role ?? "").trim();
  return s ? s : null;
}

function getRoleId(u: UserRow | null): number | null {
  if (!u) return null;
  const v = u.idRole ?? u.IdRole;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getAdministrativeUnit(u: UserRow | null): string | null {
  if (!u) return null;
  const s = String(u.administrativeUnit ?? u.AdministrativeUnit ?? "").trim();
  return s ? s : null;
}

function getAdministrativeUnitId(u: UserRow | null): number | null {
  if (!u) return null;
  const v = u.idAdministrativeUnit ?? u.IdAdministrativeUnit;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getAsset(u: UserRow | null): boolean | null {
  if (!u) return null;
  const v = u.asset ?? u.Asset;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
    if (t === "false" || t === "0" || t === "no") return false;
  }
  return null;
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asObject(v: unknown): UnknownObject | null {
  return isRecord(v) ? (v as UnknownObject) : null;
}

function pickArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;

  const obj = asObject(payload);
  if (!obj) return [];

  for (const k of keys) {
    const maybe = obj[k];
    if (Array.isArray(maybe)) return maybe;
  }

  return [];
}

function readNumber(obj: UnknownObject, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

function readString(obj: UnknownObject, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
  }
  return fallback;
}

function readBool(obj: UnknownObject, keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "true" || t === "1" || t === "si" || t === "sí") return true;
      if (t === "false" || t === "0" || t === "no") return false;
    }
  }
  return undefined;
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