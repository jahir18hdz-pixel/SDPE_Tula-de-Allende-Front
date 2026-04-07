import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

type Props = {
  modulePath: string;
};

export default function RequireModule({ modulePath }: Props) {
  const { isAuthenticated, allowedModules } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const canView = allowedModules?.has(modulePath) ?? false;

  if (!canView) {
    return <Navigate to="/sin-acceso" replace state={{ from: location }} />;
  }

  return <Outlet />;
}