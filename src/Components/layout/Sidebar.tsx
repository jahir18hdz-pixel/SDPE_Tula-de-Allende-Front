import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
import { useAuth } from "../../context/useAuth"; // ✅ ajusta la ruta si tu carpeta cambia

type Role = "PRESIDENCIA" | "TESORERIA" | "ADQUISICIONES" | "ADMIN";

const getUser = () => {
  const name = localStorage.getItem("user_name") || "Nombre de Usuario";
  const role = (localStorage.getItem("role") as Role) || "PRESIDENCIA";
  return { name, role };
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
  return !!target.closest("button, a");
}

export default function Sidebar({
  collapsed = false,
  onNavigate,
  onBackgroundToggle,
}: SidebarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth(); // ✅

  const { name } = getUser();
  const [catalogsOpen, setCatalogsOpen] = useState(false);

  const menu: MenuItem[] = useMemo(() => {
    return [
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

          // ✅ COG
          { label: "COG", to: "/catalogos/cog" },

          // ✅ NUEVO: Fondo de Financiamiento
          { label: "Fondo de Financiamiento", to: "/catalogos/fondo-financiamiento" },
        ],
      },
      {
        label: "Usuarios",
        to: "/usuarios/nuevo",
        icon: <FiUserPlus />,
      },
    ];
  }, []);

  const handleLogout = () => {
    onNavigate?.();
    logout(); // ✅ actualiza tokenState al instante
    navigate("/login", { replace: true }); // ✅ sin pasar por "/"
  };

  const toggleTheme = () => {
    document.body.classList.toggle("light-theme");
  };

  const handleCatalogClick = () => {
    if (collapsed && onBackgroundToggle) onBackgroundToggle();
    setCatalogsOpen((v) => !v);
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      onMouseDownCapture={(e) => {
        // ✅ FIX: no cerrar si la interacción viene del scroll/menú
        if (!onBackgroundToggle) return;

        const target = e.target as HTMLElement | null;
        if (!target) return;

        // 1) Si el click/drag fue dentro del área scrolleable, NO cerrar
        if (target.closest(`.${styles.scrollArea}`)) return;

        // 2) Si fue en botón/link, NO cerrar
        if (isInteractiveTarget(target)) return;

        // 3) Solo en áreas "muertas" del sidebar
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
          {!collapsed && <span className={styles.userName}>{name}</span>}
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
                    {!collapsed && (
                      <span className={styles.label}>{item.label}</span>
                    )}
                  </span>

                  {!collapsed && (
                    <span
                      className={`${styles.chev} ${
                        catalogsOpen ? styles.chevOpen : ""
                      }`}
                    >
                      <FiChevronDown />
                    </span>
                  )}
                </button>

                {!collapsed && (
                  <div
                    className={`${styles.submenu} ${
                      catalogsOpen ? styles.submenuOpen : ""
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

        <button
          type="button"
          className={styles.bottomBtn}
          onClick={handleLogout}
        >
          <span className={styles.icon}>
            <FiLogOut />
          </span>
          {!collapsed && <span className={styles.label}>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
