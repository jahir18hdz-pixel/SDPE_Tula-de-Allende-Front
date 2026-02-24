import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import type { CSSProperties } from "react";

import Sidebar from "../layout/Sidebar";
import TopBar from "../layout/TopBar";

import styles from "./AppLayout.module.css";

type LayoutVars = CSSProperties & {
  ["--sidebar-w"]?: string;
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ Sidebar responsivo: más ancho en 1920×1080
  const sidebarWidth = useMemo(
    () =>
      collapsed
        ? "clamp(80px, 7.5vw, 112px)" // colapsado responsivo
        : "clamp(280px, 20vw, 380px)", // normal responsivo (en 1080p cae ~360-380px)
    [collapsed]
  );

  const closeMobile = () => setMobileOpen(false);

  const layoutStyle: LayoutVars = {
    "--sidebar-w": sidebarWidth,
  };

  return (
    <div className={styles.shell} style={layoutStyle}>
      {/* Sidebar Desktop */}
      <aside className={styles.sidebarDesktop}>
        <Sidebar
          collapsed={collapsed}
          onBackgroundToggle={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* Overlay Mobile */}
      <div
        className={`${styles.overlay} ${mobileOpen ? styles.overlayOpen : ""}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Sidebar Mobile */}
      <aside
        className={`${styles.sidebarMobile} ${
          mobileOpen ? styles.sidebarMobileOpen : ""
        }`}
      >
        <Sidebar collapsed={false} onNavigate={closeMobile} />
      </aside>

      {/* Content */}
      <div className={styles.content}>
        {/* TopBar global con botón menú */}
        <div className={styles.topbarRow}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <div className={styles.topbarGrow}>
            <TopBar />
          </div>
        </div>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
