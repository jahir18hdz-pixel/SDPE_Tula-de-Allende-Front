import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Splash from "../Modules/Auth/pages/Splash";
import Login from "../Modules/Auth/pages/Login";
import Home from "../Modules/Home/pages/home";
import UserCreate from "../Modules/Users/pages/userCreate";
import AdministrativeUnits from "../Modules/AdministrativeUnit/pages/AdministrativeUnits";
import Roles from "../Modules/Roles/pages/Roles";
import PermissionsByRole from "../Modules/Permissions/pages/Permissions";
import Cog from "../Modules/Cog/pages/Cog";
import FundingSource from "../Modules/FundingSource/pages/FundingSource";
import Prog from "../Modules/Prog/pages/Prog";
import Proyect from "../Modules/Proyect/pages/Proyec";
import ActionsPolicy from "../Modules/ActionsPolicy/pages/ActionsPolicy";
import Community from "../Modules/Community/pages/Community";

import AppLayout from "../Components/layout/AppLayout";
import RequireAuth from "./RequireAuth";
import RequireModule from "./RequireModule";

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
            {/* Home */}
            <Route element={<RequireModule modulePath="/home" />}>
              <Route path="/home" element={<Home />} />
            </Route>

            {/* Usuarios */}
            <Route element={<RequireModule modulePath="/usuarios/nuevo" />}>
              <Route path="/usuarios/nuevo" element={<UserCreate />} />
            </Route>

            {/* Catálogos */}
            <Route element={<RequireModule modulePath="/catalogos/unidades-administrativas" />}>
              <Route
                path="/catalogos/unidades-administrativas"
                element={<AdministrativeUnits />}
              />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/roles" />}>
              <Route path="/catalogos/roles" element={<Roles />} />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/permisos" />}>
              <Route path="/catalogos/permisos" element={<PermissionsByRole />} />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/cog" />}>
              <Route path="/catalogos/cog" element={<Cog />} />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/fondo-financiamiento" />}>
              <Route
                path="/catalogos/fondo-financiamiento"
                element={<FundingSource />}
              />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/acciones-poliza" />}>
              <Route
                path="/catalogos/acciones-poliza"
                element={<ActionsPolicy />}
              />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/comunidades" />}>
              <Route path="/catalogos/comunidades" element={<Community />} />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/prog" />}>
              <Route path="/catalogos/prog" element={<Prog />} />
            </Route>

            <Route element={<RequireModule modulePath="/catalogos/proyectos" />}>
              <Route path="/catalogos/proyectos" element={<Proyect />} />
            </Route>
          </Route>
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
