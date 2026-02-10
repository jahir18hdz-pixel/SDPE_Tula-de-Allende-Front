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
  FiSun,
} from "react-icons/fi";

import LogoPresi from "../../assets/images/logoRGB.png";
import { useAuth } from "../../context/useAuth";

const getUser = () => {
  // ✅ Mostrar el correo del usuario que inició sesión (guardado en Login.tsx)
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
  const { logout } = useAuth();

  const { email } = getUser();

  // Estado SOLO para el toggle manual del submenú
  const [catalogsManualOpen, setCatalogsManualOpen] = useState(false);

  const isInCatalogsRoute = location.pathname.startsWith("/catalogos/");

  // ✅ Abre Catálogos automáticamente al entrar a /catalogos/*
  //    pero permite cerrarlo manualmente después.
  // ✅ Evita warning ESLint: NO setState sincrónico dentro del effect.
  useEffect(() => {
    if (!isInCatalogsRoute) return;

    const id = window.setTimeout(() => {
      setCatalogsManualOpen(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, [isInCatalogsRoute]);

  const menu: MenuItem[] = useMemo(
    () => [
      { label: "Inicio", to: "/home", icon: <FiHome /> },
      {
        label: "Catálogos",
        icon: <FiFolder />,
        children: [
          {
            label: "Unidades Administrativas",
            to: "/catalogos/unidades-administrativas",
          },
          { label: "Roles", to: "/catalogos/roles" },
          { label: "Permisos", to: "/catalogos/permisos" },
          { label: "COG", to: "/catalogos/cog" },
          { label: "Fondo de Financiamiento", to: "/catalogos/fondo-financiamiento" },
          { label: "Acciones de Póliza", to: "/catalogos/acciones-poliza" },
          { label: "Comunidades", to: "/catalogos/comunidades" },
          { label: "PROG", to: "/catalogos/prog" },
          { label: "Proyectos", to: "/catalogos/proyectos" },
        ],
      },
      { label: "Usuarios", to: "/usuarios/nuevo", icon: <FiUserPlus /> },
    ],
    []
  );

  const handleLogout = () => {
    onNavigate?.();
    logout(); // tu clearToken() ya elimina userEmail ✅
    navigate("/login", { replace: true });
  };

  const toggleTheme = () => {
    document.body.classList.toggle("light-theme");
  };

  const handleCatalogClick = () => {
    if (collapsed && onBackgroundToggle) onBackgroundToggle();
    setCatalogsManualOpen((v) => !v); // ✅ ya lo puedes cerrar aunque estés en /catalogos/*
  };

  const shouldShowSubmenu = catalogsManualOpen && !collapsed;

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      onPointerDownCapture={(e) => {
        if (!onBackgroundToggle) return;

        const target = e.target as HTMLElement | null;
        if (!target) return;

        // ✅ Si fue botón/link/input/etc, NO togglear
        if (isInteractiveTarget(target)) return;

        // ✅ En cualquier otro caso, togglear
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

        {/* Perfil (en colapsado lo mueves visualmente con CSS) */}
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
          {menu.map((item) =>
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

      {/* BOTTOM */}
      <div className={styles.bottom}>
        <button type="button" className={styles.bottomBtn} onClick={toggleTheme}>
          <span className={styles.icon}>
            <FiSun />
          </span>
          {!collapsed && <span className={styles.label}>Modo claro</span>}
        </button>

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
