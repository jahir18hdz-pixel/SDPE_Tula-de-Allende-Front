import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiFilter } from "react-icons/fi";
import styles from "../styles/home.module.css";

type Estado = "Completo" | "Incompleto";

type Row = {
  folio: string;
  poliza: string;
  adquisicion: string;
  area: string;
  fecha: string;
  estado: Estado;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const data: Row[] = [
    { folio: "808595", poliza: "458769", adquisicion: "Camioneta", area: "Planeación", fecha: "12/01/2025", estado: "Completo" },
    { folio: "808597", poliza: "458770", adquisicion: "Botellas de agua", area: "Planeación", fecha: "15/01/2025", estado: "Incompleto" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => r.folio.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className={styles.page}>

      {/* Acciones + KPI */}
      <div className={styles.actionsRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Adquisiciones</div>
          <div className={styles.kpiValue}>{filtered.length}</div>
        </div>

        <div className={styles.searchBar}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar adquisición por folio"
          />
          <button type="button" className={styles.iconBtn}>
            <FiSearch />
          </button>
          <button type="button" className={styles.iconBtn}>
            <FiFilter />
          </button>
        </div>

        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => navigate("/adquisiciones/registrar")}
        >
          Registrar Adquisición
        </button>
      </div>

      {/* Tabla */}
      <div className={styles.sectionTitleRow}>
        <h2>Registros de adquisiciones</h2>
        <span className={styles.sectionNote}>(por fecha más reciente)</span>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Póliza</th>
                <th>Adquisición</th>
                <th>Área</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Información</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.folio}>
                  <td>{r.folio}</td>
                  <td>{r.poliza}</td>
                  <td>{r.adquisicion}</td>
                  <td>{r.area}</td>
                  <td>{r.fecha}</td>
                  <td>
                    <span className={r.estado === "Completo" ? styles.badgeOk : styles.badgeBad}>
                      {r.estado}
                    </span>
                  </td>
                  <td>
                    <button type="button" className={styles.secondaryBtn}>
                      Ver más
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>Paginación</div>
      </div>
    </div>
  );
}
