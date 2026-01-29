import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { getToken } from "../services/token.service";

export default function RequireAuth() {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Detecta si borras token en consola (misma pestaña) y te saca
  useEffect(() => {
    const id = window.setInterval(() => {
      const token = getToken();
      if (!token) {
        logout();
        navigate("/login", { replace: true, state: { from: location } });
      }
    }, 500);

    return () => window.clearInterval(id);
  }, [logout, navigate, location]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
