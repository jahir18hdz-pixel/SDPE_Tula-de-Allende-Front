import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Splash from "../Modules/Auth/pages/Splash";
import Login from "../Modules/Auth/pages/Login";
import Home from "../Modules/Home/pages/home";
import UserCreate from "../Modules/Users/pages/userCreate";
import AdministrativeUnits from "../Modules/AdministrativeUnit/pages/AdministrativeUnits";
import Roles from "../Modules/Roles/pages/Roles";
import PermissionsByRole from "../Modules/Permissions/pages/Permissions";
import Cog from "../Modules/Cog/pages/Cog";
import FundingSource from "../Modules/FundingSource/pages/FundingSource"; // ✅ NUEVO

import AppLayout from "../Components/layout/AppLayout";
import RequireAuth from "./RequireAuth";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* públicas */}
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />

        {/* privadas */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/usuarios/nuevo" element={<UserCreate />} />

            {/*Unidades Administrativas */}
            <Route
              path="/catalogos/unidades-administrativas"
              element={<AdministrativeUnits />}
            />

            {/*Roles */}
            <Route path="/catalogos/roles" element={<Roles />} />

            {/*Permisos */}
            <Route path="/catalogos/permisos" element={<PermissionsByRole />} />

            {/*COG */}
            <Route path="/catalogos/cog" element={<Cog />} />

            {/* ✅ Fondo de Financiamiento */}
            <Route
              path="/catalogos/fondo-financiamiento"
              element={<FundingSource />}
            />
          </Route>
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
