import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import {
  FiHome,
  FiFolder,
  FiFileText,
  FiChevronDown,
  FiUser,
  FiLogOut,
  FiSun,
  FiX,
} from "react-icons/fi";
import LogoPresi from "../../assets/images/logoRGB.png";

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

  onNavigate?: () => void; // cerrar drawer móvil al navegar
  showCloseButton?: boolean; // X arriba (solo móvil)
  onClose?: () => void;

  /** ✅ click en fondo del sidebar para colapsar/expandir (solo desktop) */
  onBackgroundToggle?: () => void;
};

/** ✅ Solo bloquea si tocaste un botón o link */
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("button, a");
}

export default function Sidebar({
  collapsed = false,
  onNavigate,
  showCloseButton = false,
  onClose,
  onBackgroundToggle,
}: SidebarProps) {
  const navigate = useNavigate();
  const { name, role } = getUser();
  const [catalogsOpen, setCatalogsOpen] = useState(false);

  const menu: MenuItem[] = useMemo(() => {
    const common: MenuItem[] = [
      { label: "Inicio", to: "/home", icon: <FiHome /> },
      {
        label: "Catálogos",
        icon: <FiFolder />,
        children: [
          { label: "Proveedores", to: "/catalogos/proveedores" },
          { label: "Partidas", to: "/catalogos/partidas" },
          { label: "Áreas", to: "/catalogos/areas" },
        ],
      },
      {
        label: "Registrar Adquisición",
        to: "/adquisiciones/registrar",
        icon: <FiFileText />,
      },
    ];

    if (role === "TESORERIA") {
      return [
        { label: "Inicio", to: "/home", icon: <FiHome /> },
        {
          label: "Registrar Adquisición",
          to: "/adquisiciones/registrar",
          icon: <FiFileText />,
        },
      ];
    }

    return common;
  }, [role]);

  const handleLogout = () => {
    onNavigate?.();
    localStorage.removeItem("presidencia_session");
    localStorage.removeItem("role");
    localStorage.removeItem("user_name");
    navigate("/login", { replace: true });
  };

  const toggleTheme = () => alert("Modo claro (pendiente)");

  // ✅ Si está colapsado y el usuario toca "Catálogos", lo abrimos y expandimos primero (opcional, pero se siente pro)
  const handleCatalogClick = () => {
    if (collapsed && onBackgroundToggle) onBackgroundToggle();
    setCatalogsOpen((v) => !v);
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      onMouseDownCapture={(e) => {
        if (!onBackgroundToggle) return; // móvil: no colapsar aquí (solo drawer)
        if (isInteractiveTarget(e.target)) return; // si tocaste botón/link, no togglear
        onBackgroundToggle(); // ✅ toggle por fondo
      }}
    >
      {/* Top */}
      <div className={styles.top}>
        {/* Solo móvil: botón X */}
        {showCloseButton && (
          <div className={styles.topRow}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Título solo expandido */}
        {!collapsed && (
          <h1 className={styles.title}>
            Sistema de
            <br />
            digitalización de
            <br />
            polizas de egresos
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

      {/* Scroll Area */}
      <div className={styles.scrollArea}>
        {/* Nav */}
        <nav className={styles.nav}>
          {menu.map((item) => {
            const hasChildren = !!item.children?.length;

            if (hasChildren) {
              return (
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
                      {item.children!.map((c) => (
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
              );
            }

            return (
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
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={styles.bottom}>
          <button
            type="button"
            className={styles.bottomBtn}
            onClick={() => {
              onNavigate?.();
              toggleTheme();
            }}
          >
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
      </div>
    </aside>
  );
}
