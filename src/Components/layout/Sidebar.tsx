import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import {
  FiHome,
  FiFolder,
  FiChevronDown,
  FiUser,
  FiUserPlus,
  FiLogOut,
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

  const isInCatalogsRoute = location.pathname.startsWith("/catalogos/");

 const menu: MenuItem[] = useMemo(
  () => [
    { label: "Inicio", to: "/home", icon: <FiHome /> },
    {
      label: "Catálogos",
      icon: <FiFolder />,
      children: [
        { label: "Unidades Administrativas", to: "/catalogos/unidades-administrativas" },
        { label: "Roles", to: "/catalogos/roles" },
        { label: "Permisos", to: "/catalogos/permisos" },
        { label: "COG", to: "/catalogos/cog" },
        { label: "Fondo de Financiamiento", to: "/catalogos/fondo-financiamiento" },
        { label: "Acciones de Póliza", to: "/catalogos/acciones-poliza" },
        { label: "Comunidades", to: "/catalogos/comunidades" },
        { label: "Beneficiarios", to: "/catalogos/beneficiarios" },
        { label: "Proveedores", to: "/catalogos/proveedores" },
        { label: "PROG", to: "/catalogos/prog" },
        { label: "Proyectos", to: "/catalogos/proyectos" },
        { label: "Clasificación de Adquisiciones", to: "/catalogos/clasificacion-adquisiciones" },
        { label: "Tipos de Adquisición", to: "/catalogos/tipos-adquisicion" },
      ],
    },
    { label: "Usuarios", to: "/usuarios/nuevo", icon: <FiUserPlus /> },
  ],
  []
);

  // Filtrado por permisos
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

  // Abre/cierra Catálogos
  useEffect(() => {
    if (!isInCatalogsRoute) return;

    const hasCatalogs = filteredMenu.some(
      (m) => Array.isArray(m.children) && m.children.length > 0
    );

    const id = window.setTimeout(() => {
      setCatalogsManualOpen(hasCatalogs);
    }, 0);

    return () => window.clearTimeout(id);
  }, [isInCatalogsRoute, filteredMenu]);

  const handleLogout = () => {
    onNavigate?.();
    logout();
    navigate("/login", { replace: true });
  };


  const handleCatalogClick = () => {
    if (collapsed && onBackgroundToggle) onBackgroundToggle();
    setCatalogsManualOpen((v) => !v);
  };

  const shouldShowSubmenu = catalogsManualOpen && !collapsed;

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
      {/* TOP */}
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

      {/* MENÚ */}
      <div className={styles.scrollArea}>
        <nav className={styles.nav}>
          {filteredMenu.map((item) =>
            item.children ? (
              <div key={item.label} className={styles.group}>
                <button
                  type="button"
                  className={styles.itemBtn}
                  onClick={handleCatalogClick}
                >
                  <span className={styles.left}>
                    <span className={styles.icon}>{item.icon}</span>
                    {!collapsed && <span className={styles.label}>{item.label}</span>}
                  </span>

                  {!collapsed && (
                    <span
                      className={`${styles.chev} ${
                        catalogsManualOpen ? styles.chevOpen : ""
                      }`}
                    >
                      <FiChevronDown />
                    </span>
                  )}
                </button>

                {shouldShowSubmenu && (
                  <div
                    className={`${styles.submenu} ${
                      catalogsManualOpen ? styles.submenuOpen : ""
                    }`}
                  >
                    {item.children.map((c) => (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        onClick={() => onNavigate?.()}
                        className={({ isActive }) =>
                          isActive ? `${styles.subItem} ${styles.active}` : styles.subItem
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

      {/* BOTTOM */}
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
