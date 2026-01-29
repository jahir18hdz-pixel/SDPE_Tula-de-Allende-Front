import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Splash.module.css";
import logo from "../../../assets/images/LogoPresi.jpg";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className={styles.splashContainer}>
      <section className={styles.card}>
        <img
          src={logo}
          alt="Presidencia Municipal de Tula de Allende"
          className={styles.logo}
        />

        <h1 className={styles.title}>Presidencia Municipal</h1>
        <h2 className={styles.subtitle}>Tula de Allende, Hidalgo</h2>

        <span className={styles.divider} />

        <p className={styles.systemName}>
          Sistema de Digitalización de Pólizas de Egresos
        </p>

        <div className={styles.loader} />
      </section>
    </main>
  );
}
