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
import ActionsPolicy from "../Modules/ActionsPolicy/pages/ActionsPolicy";
import Community from "../Modules/Community/pages/Community";
import Prog from "../Modules/Prog/pages/Prog";
import Proyect from "../Modules/Proyect/pages/Proyec";
import AcquisitionClassifications from "../Modules/AcquisitionClassifications/pages/AcquisitionClassifications";
import AcquisitionTypePage from "../Modules/AcquisitionType/pages/AcquisitionType";
import BeneficiaryPage from "../Modules/Beneficiary/pages/Beneficiary";
import SupplierPage from "../Modules/Supplier/pages/Supplier";
import DocumentType from "../Modules/Documents/pages/DocumentType";
import PaymentPolicy from "../Modules/Policy/pages/PaymentPolicy";
import AcquisitionRequest from "../Modules/AcquisitionRequest/pages/AcquisitionRequest";
import ExpedientDocuments from "../Modules/ExpedientDocument/pages/ExpedientDocuments";
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

            {/* =========================
                ADQUISICIONES
            ========================== */}
            <Route element={<RequireModule modulePath="/adquisiciones/registrar" />}>
              <Route path="/adquisiciones/registrar" element={<AcquisitionRequest />} />
            </Route>

            {/* LISTA / CHECKLIST DE EXPEDIENTE POR SOLICITUD */}
            <Route element={<RequireModule modulePath="/adquisiciones/expediente" />}>
              <Route path="/adquisiciones/:id/expediente" element={<ExpedientDocuments />} />
            </Route>

            {/* =========================
                CATÁLOGOS
            ========================== */}

            {/* Unidades administrativas */}
            <Route element={<RequireModule modulePath="/catalogos/unidades-administrativas" />}>
              <Route
                path="/catalogos/unidades-administrativas"
                element={<AdministrativeUnits />}
              />
            </Route>

            {/* Roles */}
            <Route element={<RequireModule modulePath="/catalogos/roles" />}>
              <Route path="/catalogos/roles" element={<Roles />} />
            </Route>

            {/* Permisos */}
            <Route element={<RequireModule modulePath="/catalogos/permisos" />}>
              <Route path="/catalogos/permisos" element={<PermissionsByRole />} />
            </Route>

            {/* COG */}
            <Route element={<RequireModule modulePath="/catalogos/cog" />}>
              <Route path="/catalogos/cog" element={<Cog />} />
            </Route>

            {/* Fondo financiamiento */}
            <Route element={<RequireModule modulePath="/catalogos/fondo-financiamiento" />}>
              <Route path="/catalogos/fondo-financiamiento" element={<FundingSource />} />
            </Route>

            {/* Acciones póliza */}
            <Route element={<RequireModule modulePath="/catalogos/acciones-poliza" />}>
              <Route path="/catalogos/acciones-poliza" element={<ActionsPolicy />} />
            </Route>

            {/* Pólizas de pago */}
            <Route element={<RequireModule modulePath="/catalogos/polizas" />}>
              <Route path="/catalogos/polizas" element={<PaymentPolicy />} />
            </Route>

            {/* Comunidades */}
            <Route element={<RequireModule modulePath="/catalogos/comunidades" />}>
              <Route path="/catalogos/comunidades" element={<Community />} />
            </Route>

            {/* Beneficiarios */}
            <Route element={<RequireModule modulePath="/catalogos/beneficiarios" />}>
              <Route path="/catalogos/beneficiarios" element={<BeneficiaryPage />} />
            </Route>

            {/* Proveedores */}
            <Route element={<RequireModule modulePath="/catalogos/proveedores" />}>
              <Route path="/catalogos/proveedores" element={<SupplierPage />} />
            </Route>

            {/* Prog */}
            <Route element={<RequireModule modulePath="/catalogos/prog" />}>
              <Route path="/catalogos/prog" element={<Prog />} />
            </Route>

            {/* Proyectos */}
            <Route element={<RequireModule modulePath="/catalogos/proyectos" />}>
              <Route path="/catalogos/proyectos" element={<Proyect />} />
            </Route>

            {/* Clasificación de adquisiciones */}
            <Route element={<RequireModule modulePath="/catalogos/clasificacion-adquisiciones" />}>
              <Route
                path="/catalogos/clasificacion-adquisiciones"
                element={<AcquisitionClassifications />}
              />
            </Route>

            {/* Tipos de adquisición */}
            <Route element={<RequireModule modulePath="/catalogos/tipos-adquisicion" />}>
              <Route path="/catalogos/tipos-adquisicion" element={<AcquisitionTypePage />} />
            </Route>

            {/* Tipos de documento */}
            <Route element={<RequireModule modulePath="/catalogos/tipos-documento" />}>
              <Route path="/catalogos/tipos-documento" element={<DocumentType />} />
            </Route>
          </Route>
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}