import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import {
  FiHome,
  FiFolder,
  FiChevronDown,
  FiUser,
  FiLogOut,
  FiSettings,
  FiBell,
} from "react-icons/fi";

import LogoPresi from "../../assets/images/logoRGB.png";
import { useAuth } from "../../context/useAuth";

const getUser = () => {
  const email = localStorage.getItem("userEmail") || "correo@ejemplo.com";
  return { email };
};

type MenuItem = {
  label: string;
  to?: string;
  icon: React.ReactNode;
  children?: { label: string; to: string }[];
};

type SidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  onBackgroundToggle?: () => void;
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("button, a, input, textarea, select, label");
}

export default function Sidebar({
  collapsed = false,
  onNavigate,
  onBackgroundToggle,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const { logout, allowedModules } = useAuth();
  const { email } = getUser();

  const [catalogsManualOpen, setCatalogsManualOpen] = useState(false);
  const [adminManualOpen, setAdminManualOpen] = useState(false);

  const isInCatalogsRoute = location.pathname.startsWith("/catalogos/");
  const isInAdminRoute =
    location.pathname.startsWith("/usuarios") ||
    location.pathname.startsWith("/catalogos/roles") ||
    location.pathname.startsWith("/catalogos/permisos") ||
    location.pathname.startsWith("/catalogos/configuracion-sistema");

  const menu: MenuItem[] = useMemo(
    () => [
      { label: "Inicio", to: "/home", icon: <FiHome /> },
      { label: "Notificaciones", to: "/notificaciones", icon: <FiBell /> },

      {
        label: "Catálogos",
        icon: <FiFolder />,
        children: [
          { label: "Unidades Administrativas", to: "/catalogos/unidades-administrativas" },
          { label: "COG", to: "/catalogos/cog" },
          { label: "Fondo de Financiamiento", to: "/catalogos/fondo-financiamiento" },
          { label: "Pólizas de Pago", to: "/catalogos/polizas" },
          { label: "Comunidades", to: "/catalogos/comunidades" },
          { label: "Beneficiarios", to: "/catalogos/beneficiarios" },
          { label: "Proveedores", to: "/catalogos/proveedores" },
          { label: "PROG", to: "/catalogos/prog" },
          { label: "Proyectos", to: "/catalogos/proyectos" },
          { label: "Clasificación de Adquisiciones", to: "/catalogos/clasificacion-adquisiciones" },
          { label: "Tipos de Adquisición", to: "/catalogos/tipos-adquisicion" },
          { label: "Tipos de Documento", to: "/catalogos/tipos-documento" },
        ],
      },

      {
        label: "Administración",
        icon: <FiSettings />,
        children: [
          { label: "Roles", to: "/catalogos/roles" },
          { label: "Permisos", to: "/catalogos/permisos" },
          { label: "Usuarios", to: "/usuarios/nuevo" },
          { label: "Configuración del sistema", to: "/catalogos/configuracion-sistema" },
        ],
      },
    ],
    []
  );

  const filteredMenu: MenuItem[] = useMemo(() => {
    const canSee = (path?: string) => {
      if (!path) return true;
      return allowedModules?.has(path) ?? false;
    };

    return menu
      .map((item) => {
        if (!item.children) {
          return canSee(item.to) ? item : null;
        }

        const kids = item.children.filter((c) => canSee(c.to));
        if (kids.length === 0) return null;

        return { ...item, children: kids };
      })
      .filter((x): x is MenuItem => !!x);
  }, [menu, allowedModules]);

  useEffect(() => {
    if (!isInCatalogsRoute) return;

    const catalogsGroup = filteredMenu.find((m) => m.label === "Catálogos");
    const hasCatalogs =
      Array.isArray(catalogsGroup?.children) && catalogsGroup.children.length > 0;

    const id = window.setTimeout(() => {
      setCatalogsManualOpen(hasCatalogs);
    }, 0);

    return () => window.clearTimeout(id);
  }, [isInCatalogsRoute, filteredMenu]);

  useEffect(() => {
    if (!isInAdminRoute) return;

    const adminGroup = filteredMenu.find((m) => m.label === "Administración");
    const hasAdmin =
      Array.isArray(adminGroup?.children) && adminGroup.children.length > 0;

    const id = window.setTimeout(() => {
      setAdminManualOpen(hasAdmin);
    }, 0);

    return () => window.clearTimeout(id);
  }, [isInAdminRoute, filteredMenu]);

  const handleLogout = () => {
    onNavigate?.();
    logout();
    navigate("/login", { replace: true });
  };

  const handleGroupClick = (label: string) => {
    if (collapsed && onBackgroundToggle) onBackgroundToggle();

    if (label === "Catálogos") {
      setCatalogsManualOpen((v) => !v);
    }

    if (label === "Administración") {
      setAdminManualOpen((v) => !v);
    }
  };

  const shouldShowSubmenu = (label: string) => {
    if (collapsed) return false;
    if (label === "Catálogos") return catalogsManualOpen;
    if (label === "Administración") return adminManualOpen;
    return false;
  };

  const isGroupOpen = (label: string) => {
    if (label === "Catálogos") return catalogsManualOpen;
    if (label === "Administración") return adminManualOpen;
    return false;
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      onPointerDownCapture={(e) => {
        if (!onBackgroundToggle) return;

        const target = e.target as HTMLElement | null;
        if (!target) return;

        if (isInteractiveTarget(target)) return;
        onBackgroundToggle();
      }}
    >
      <div className={styles.top}>
        {!collapsed && (
          <h1 className={styles.title}>
            Sistema de
            <br />
            digitalización de
            <br />
            pólizas de egresos
          </h1>
        )}

        <div className={styles.logoWrap}>
          <img src={LogoPresi} alt="Tula de Allende" className={styles.logo} />
        </div>

        <div className={styles.goldLine} />

        <div className={styles.userRow}>
          <span className={styles.userIcon}>
            <FiUser />
          </span>
          {!collapsed && <span className={styles.userName}>{email}</span>}
        </div>

        <div className={styles.goldLine} />
      </div>

      <div className={styles.scrollArea}>
        <nav className={styles.nav}>
          {filteredMenu.map((item) =>
            item.children ? (
              <div key={item.label} className={styles.group}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  onClick={() => handleGroupClick(item.label)}
                >
                  <span className={styles.left}>
                    <span className={styles.icon}>{item.icon}</span>
                    {!collapsed && <span className={styles.label}>{item.label}</span>}
                  </span>

                  {!collapsed && (
                    <span
                      className={`${styles.chev} ${
                        isGroupOpen(item.label) ? styles.chevOpen : ""
                      }`}
                    >
                      <FiChevronDown />
                    </span>
                  )}
                </button>

                {shouldShowSubmenu(item.label) && (
                  <div
                    className={`${styles.submenu} ${
                      isGroupOpen(item.label) ? styles.submenuOpen : ""
                    }`}
                  >
                    {item.children.map((c) => (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        onClick={() => onNavigate?.()}
                        className={({ isActive }) =>
                          isActive
                            ? `${styles.subItem} ${styles.active}`
                            : styles.subItem
                        }
                      >
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  isActive ? `${styles.item} ${styles.active}` : styles.item
                }
              >
                <span className={styles.icon}>{item.icon}</span>
                {!collapsed && <span className={styles.label}>{item.label}</span>}
              </NavLink>
            )
          )}
        </nav>
      </div>

      <div className={styles.bottom}>
        <button type="button" className={styles.bottomBtn} onClick={handleLogout}>
          <span className={styles.icon}>
            <FiLogOut />
          </span>
          {!collapsed && <span className={styles.label}>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}