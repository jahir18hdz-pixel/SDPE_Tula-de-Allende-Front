import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import LogoPresi from "../../../assets/images/logoRGB.png";
import Icono from "../../../assets/images/iconoatlantevino.png";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import { login, extractToken } from "../../../services/authService";
import { useAuth } from "../../../context/useAuth";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken, isAuthenticated } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastMsg, setToastMsg] = useState<string>("");

  const navTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((type: ToastType, msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  }, []);

  // ✅ si ya hay sesión, no dejes ver login
  useEffect(() => {
    if (isAuthenticated) navigate("/home", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await login({ email, password });
      const token = extractToken(data);

      if (!token) throw new Error("El backend respondió, pero no llegó el token.");

      // ✅ aquí ya no guardas token directo: lo maneja AuthProvider
      loginWithToken(token);

      // si quieres guardar el correo (opcional)
      localStorage.setItem("userEmail", email);

      showToast("success", "Se inició sesión correctamente");

      if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = window.setTimeout(
        () => navigate("/home", { replace: true }),
        800
      );
    } catch (err) {
      console.error(err);
      showToast("error", "No se pudo iniciar sesión, verifique los datos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      {/* PANEL IZQUIERDO */}
      <div className={styles.leftPanel}>
        <div className={styles.logoCard}>
          <img src={LogoPresi} alt="Tula de Allende" />
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <img src={Icono} alt="Icono" className={styles.formIcon} />

          <h2 className={styles.formTitle}>Iniciar Sesión</h2>
          <div className={styles.underline} />

          <p className={styles.description}>
            Plataforma digital para el crecimiento y desarrollo del municipio
          </p>

          <form onSubmit={handleSubmit}>
            {/* CORREO */}
            <div className={styles.inputWrapper}>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />
              <span className={styles.icon}>@</span>
            </div>

            {/* CONTRASEÑA */}
            <div className={styles.inputWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />

              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Mostrar u ocultar contraseña"
                disabled={isLoading}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className={styles.forgotPassContainer}>
              <a href="#" className={styles.forgotPass}>
                Olvidé contraseña
              </a>
            </div>

            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? "Cargando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
