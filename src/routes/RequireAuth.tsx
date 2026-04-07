import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/useAuth";
import { getJwtExpMs, isJwtExpired } from "../services/jwtExpiry";

export default function RequireAuth() {
  const { isAuthenticated, logout, token } = useAuth(); // 👈 usa token del contexto
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  // Limpia cualquier timer anterior
  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimer();

    // si NO hay token => fuera (logout manual entra aquí)
    if (!token) return;

    // si ya expiró => fuera
    if (isJwtExpired(token)) {
      logout();
      navigate("/login", { replace: true, state: { from: location } });
      return;
    }

    // programa cierre exacto al expirar
    const expMs = getJwtExpMs(token);
    if (!expMs) return;

    const msLeft = expMs - Date.now();
    timerRef.current = window.setTimeout(() => {
      logout();
      navigate("/login", { replace: true, state: { from: location } });
    }, Math.max(0, msLeft));

    return () => clearTimer();
  }, [token, logout, navigate, location]); 

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
