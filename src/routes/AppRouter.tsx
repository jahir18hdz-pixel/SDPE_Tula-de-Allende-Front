import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Splash from "../Modules/Auth/pages/Splash";
import Login from "../Modules/Auth/pages/Login";
import Home from "../Modules/Home/pages/home";
import UserCreate from "../Modules/Users/pages/userCreate";
import AdministrativeUnits from "../Modules/AdministrativeUnit/pages/AdministrativeUnits"; // ✅

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

            <Route
              path="/catalogos/unidades-administrativas"
              element={<AdministrativeUnits />}
            />
          </Route>
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
