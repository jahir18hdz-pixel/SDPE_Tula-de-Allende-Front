// TopBar.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiClock, FiCalendar } from "react-icons/fi";
import styles from "./TopBar.module.css";

function titleFromPath(pathname: string) {
  if (pathname === "/home") return "Inicio";
  if (pathname === "/usuarios/nuevo") return "Usuarios";
  if (pathname.startsWith("/adquisiciones/registrar")) return "Registrar adquisición";
  if (pathname.startsWith("/catalogos/proveedores")) return "Catálogo: Proveedores";
  if (pathname.startsWith("/catalogos/partidas")) return "Catálogo: Partidas";
  if (pathname.startsWith("/catalogos/areas")) return "Catálogo: Áreas";

  const last = pathname.split("/").filter(Boolean).pop() || "Inicio";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function TopBar() {
  const { pathname } = useLocation();
  const title = useMemo(() => titleFromPath(pathname), [pathname]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  );

  const dateStr = useMemo(
    () =>
      now.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [now]
  );

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <div className={styles.topTitle}>{title}</div>
      </div>

      <div className={styles.datetimeCard}>
        <div className={styles.dtRow}>
          <FiClock />
          <span>{timeStr}</span>
        </div>
        <div className={styles.dtRow}>
          <FiCalendar />
          <span>{dateStr}</span>
        </div>
      </div>
    </header>
  );
}
