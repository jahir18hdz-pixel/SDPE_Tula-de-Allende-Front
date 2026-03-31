import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import type { CSSProperties } from "react";

import Sidebar from "../layout/Sidebar";

import styles from "./AppLayout.module.css";

type LayoutVars = CSSProperties & {
  ["--sidebar-w"]?: string;
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = useMemo(
    () =>
      collapsed
        ? "clamp(80px, 7.5vw, 112px)"
        : "clamp(280px, 20vw, 380px)",
    [collapsed]
  );

  const closeMobile = () => setMobileOpen(false);

  const layoutStyle: LayoutVars = {
    "--sidebar-w": sidebarWidth,
  };

  return (
    <div className={styles.shell} style={layoutStyle}>
      <aside className={styles.sidebarDesktop}>
        <Sidebar
          collapsed={collapsed}
          onBackgroundToggle={() => setCollapsed((v) => !v)}
        />
      </aside>

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
        <Sidebar collapsed={false} onNavigate={closeMobile} />
      </aside>

      <div className={styles.content}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}