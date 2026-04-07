import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import LogoPresi from "../../../assets/images/logoRGB.png";
import Icono from "../../../assets/images/iconoatlantevino.png";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import {
  login,
  recoverPassword,
  validateResetCode,
  changePassword,
  extractToken,
} from "../../../services/authService";
import { useAuth } from "../../../context/useAuth";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";

type Mode = "login" | "forgot";
type ForgotStep = "request" | "validate" | "change";

type PermissionGroupDto = {
  Module?: string;
  Action?: string[] | string;
  module?: string;
  action?: string[] | string;
  [key: string]: unknown;
};

type LoginResponseWithPerms = {
  Permissions?: PermissionGroupDto[];
  permissions?: PermissionGroupDto[];
};

function getErrorMessage(err: unknown, fallback = "Ocurrió un error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  if (typeof err === "object" && err !== null) {
    const maybeMsg = (err as { message?: unknown }).message;
    if (typeof maybeMsg === "string") return maybeMsg;
  }

  return fallback;
}

function normalizeActions(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return [];
}

function getPermissions(data: unknown): PermissionGroupDto[] {
  const d = data as LoginResponseWithPerms;
  const perms = d.Permissions ?? d.permissions ?? [];
  return Array.isArray(perms) ? perms : [];
}

function buildAllowedModules(perms: PermissionGroupDto[]): string[] {
  return perms
    .filter((p) => {
      const actionsRaw = p.Action ?? p.action;
      const actions = normalizeActions(actionsRaw).map((a) =>
        a.trim().toUpperCase()
      );
      return actions.includes("VIEW");
    })
    .map((p) => String(p.Module ?? p.module ?? "").trim())
    .filter(Boolean);
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken, isAuthenticated } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [code, setCode] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

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

  useEffect(() => {
    if (!isAuthenticated || mode !== "login") return;

    const storedModules = JSON.parse(
      localStorage.getItem("allowedModules") || "[]"
    ) as string[];

    const nextRoute = storedModules.length > 0 ? "/home" : "/sin-acceso";
    navigate(nextRoute, { replace: true });
  }, [isAuthenticated, navigate, mode]);

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current !== null) {
        window.clearTimeout(navTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const cleanEmail = email.trim();

      const data = await login({ email: cleanEmail, password });
      const token = extractToken(data);
      if (!token) throw new Error("El backend no devolvió un token válido");

      const perms = getPermissions(data);
      const allowedModules = buildAllowedModules(perms);

      localStorage.setItem("auth", JSON.stringify(data));
      localStorage.setItem("userEmail", cleanEmail);
      localStorage.setItem("allowedModules", JSON.stringify(allowedModules));

      loginWithToken(token, cleanEmail, allowedModules);

      showToast("success", "Sesión iniciada correctamente");

      const nextRoute = allowedModules.length > 0 ? "/home" : "/sin-acceso";

      if (navTimeoutRef.current !== null) {
        window.clearTimeout(navTimeoutRef.current);
      }

      navTimeoutRef.current = window.setTimeout(() => {
        navigate(nextRoute, { replace: true });
      }, 800);
    } catch (error: unknown) {
      console.error("❌ Error en login:", error);
      showToast("error", getErrorMessage(error, "No se pudo iniciar sesión"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = () => {
    setMode("forgot");
    setForgotStep("request");

    setPassword("");
    setShowPassword(false);

    setCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
  };

  const handleBackToLogin = () => {
    setMode("login");
    setForgotStep("request");

    setCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      showToast("error", "Escribe tu correo");
      return;
    }

    setIsLoading(true);
    try {
      const msg = await recoverPassword({ email: cleanEmail });
      showToast(
        "success",
        msg || "Si el correo existe, se enviará un código de recuperación."
      );
      setForgotStep("validate");
    } catch (err: unknown) {
      showToast("error", getErrorMessage(err, "No se pudo enviar el código"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanCode = code.trim();

    if (!cleanEmail) return showToast("error", "Escribe tu correo");
    if (!cleanCode) return showToast("error", "Escribe el código");

    setIsLoading(true);
    try {
      const msg = await validateResetCode({
        email: cleanEmail,
        code: cleanCode,
      });
      showToast("success", msg || "Código válido");
      setForgotStep("change");
    } catch (err: unknown) {
      showToast("error", getErrorMessage(err, "Código inválido o expirado"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanCode = code.trim();
    const np = newPassword;
    const cp = confirmNewPassword;

    if (!cleanEmail) return showToast("error", "Escribe tu correo");
    if (!cleanCode) return showToast("error", "Falta el código");
    if (!np) return showToast("error", "Escribe la nueva contraseña");
    if (np.length < 6) {
      return showToast(
        "error",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }
    if (np !== cp) return showToast("error", "Las contraseñas no coinciden");

    setIsLoading(true);
    try {
      const msg = await changePassword({
        email: cleanEmail,
        code: cleanCode,
        newPassword: np,
      });

      showToast("success", msg || "Contraseña actualizada correctamente.");

      setMode("login");
      setForgotStep("request");

      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
    } catch (err: unknown) {
      showToast(
        "error",
        getErrorMessage(err, "No se pudo cambiar la contraseña")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isForgot = mode === "forgot";

  return (
    <div
      className={`${styles.loginContainer} ${isForgot ? styles.isForgot : ""}`}
    >
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
        durationMs={3200}
      />

      <div className={styles.leftPanel}>
        <div className={styles.logoCard}>
          <img src={LogoPresi} alt="Tula de Allende" />
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <img src={Icono} alt="Icono" className={styles.formIcon} />

          <h2 className={styles.formTitle}>
            {isForgot ? "Recuperar Contraseña" : "Iniciar Sesión"}
          </h2>
          <div className={styles.underline} />

          <p className={styles.description}>
            {isForgot
              ? forgotStep === "request"
                ? "Escribe tu correo y te enviaremos un código de recuperación."
                : forgotStep === "validate"
                ? "Escribe el código que te llegó al correo."
                : "Ingresa tu nueva contraseña."
              : "Plataforma digital para el crecimiento y desarrollo del municipio"}
          </p>

          {!isForgot ? (
            <form onSubmit={handleSubmit}>
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
                <button
                  type="button"
                  className={styles.forgotPass}
                  onClick={handleForgot}
                  disabled={isLoading}
                >
                  Olvidé contraseña
                </button>
              </div>

              <button
                type="submit"
                className={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? "Cargando..." : "Iniciar sesión"}
              </button>
            </form>
          ) : forgotStep === "request" ? (
            <form onSubmit={handleSendReset}>
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

              <button
                type="submit"
                className={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar código"}
              </button>

              <button
                type="button"
                className={styles.backLink}
                onClick={handleBackToLogin}
                disabled={isLoading}
              >
                Volver a iniciar sesión
              </button>
            </form>
          ) : forgotStep === "validate" ? (
            <form onSubmit={handleValidateCode}>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Código de recuperación"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                className={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? "Validando..." : "Validar código"}
              </button>

              <div className={styles.actionsContainer}>
                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => setForgotStep("request")}
                  disabled={isLoading}
                >
                  Reenviar código
                </button>

                <button
                  type="button"
                  className={styles.backLink}
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  Volver a iniciar sesión
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div className={styles.inputWrapper}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowNewPassword((p) => !p)}
                  aria-label="Mostrar u ocultar nueva contraseña"
                  disabled={isLoading}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className={styles.inputWrapper}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Confirmar nueva contraseña"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? "Guardando..." : "Cambiar contraseña"}
              </button>

              <button
                type="button"
                className={styles.backLink}
                onClick={handleBackToLogin}
                disabled={isLoading}
              >
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;