import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import type { CSSProperties } from "react";
import Sidebar from "../layout/sidebar";
import styles from "./AppLayout.module.css";

type LayoutVars = CSSProperties & {
  ["--sidebar-w"]?: string;
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = useMemo(() => (collapsed ? 88 : 280), [collapsed]);

  const closeMobile = () => setMobileOpen(false);

  const layoutStyle: LayoutVars = {
    "--sidebar-w": `${sidebarWidth}px`,
  };

  return (
    <div className={styles.shell} style={layoutStyle}>
      {/* Sidebar Desktop */}
      <aside className={styles.sidebarDesktop}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onBackgroundToggle={() => setCollapsed((v) => !v)} // ✅ aquí
        />
      </aside>

      {/* Sidebar Mobile */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.overlayOpen : ""}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <aside
        className={`${styles.sidebarMobile} ${
          mobileOpen ? styles.sidebarMobileOpen : ""
        }`}
      >
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onNavigate={closeMobile}
          showCloseButton
          onClose={closeMobile}
          // ✅ NO pasar onBackgroundToggle en móvil
        />
      </aside>

      {/* Content */}
      <div className={styles.content}>
        <header className={styles.topbar}>
          <button
            className={styles.menuBtn}
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className={styles.topbarTitle}>Sistema</div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
