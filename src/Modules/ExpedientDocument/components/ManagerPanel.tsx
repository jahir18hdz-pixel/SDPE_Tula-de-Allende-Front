import React from "react";
import styles from "../styles/managerPanel.module.css";
import type {
  AdministrativeUnitOption,
  ManagerFormState,
} from "../types/expedient.types";

type Props = {
  open: boolean;
  saving: boolean;
  loadingAdministrativeUnits: boolean;
  administrativeUnits: AdministrativeUnitOption[];
  managerForm: ManagerFormState;
  setManagerForm: React.Dispatch<React.SetStateAction<ManagerFormState>>;
  onClose: () => void;
  onSave: () => void;
};

export default function ManagerPanel({
  open,
  saving,
  loadingAdministrativeUnits,
  administrativeUnits,
  managerForm,
  setManagerForm,
  onClose,
  onSave,
}: Props) {
  return (
    <div
      className={`${styles.uploadOverlay} ${
        open ? styles.uploadOverlayOpen : styles.uploadOverlayClosed
      }`}
      aria-hidden={!open}
    >
      <div className={styles.uploadSheet}>
        <div className={styles.uploadSheetHeader}>
          <div className={styles.uploadSheetTitleWrap}>
            <div className={styles.uploadHandle} />
            <div className={styles.uploadSheetTitle}>
              {managerForm.idRequestManager
                ? "Editar responsable"
                : "Asignar responsable"}
            </div>
            <div className={styles.uploadSheetNote}>
              Captura o actualiza la información del responsable de la solicitud
            </div>
          </div>

          <div className={styles.uploadSheetActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className={styles.uploadSheetBody}>
          <div className={styles.managerFormWrap}>
            <div className={styles.managerSectionCard}>
              <div className={styles.editorSectionTitle}>
                Área administrativa
              </div>

              <div className={styles.editorFloatingSelectField}>
                <span className={styles.editorFloatingLabel}>Área</span>
                <select
                  className={styles.editorFloatingSelect}
                  value={managerForm.idAdministrativeUnit ?? ""}
                  onChange={(e) =>
                    setManagerForm((prev) => ({
                      ...prev,
                      idAdministrativeUnit: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  disabled={saving || loadingAdministrativeUnits}
                >
                  <option value="">
                    {loadingAdministrativeUnits
                      ? "Cargando áreas..."
                      : "Seleccionar área administrativa…"}
                  </option>

                  {administrativeUnits.map((u) => (
                    <option
                      key={u.idAdministrativeUnit}
                      value={u.idAdministrativeUnit}
                    >
                      {u.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.managerSectionCard}>
              <div className={styles.editorSectionTitle}>
                Datos del responsable
              </div>

              <div className={styles.formGridTwo}>
                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>Nombre(s)</span>
                  <input
                    className={styles.editorFloatingInput}
                    value={managerForm.firstName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="Captura el nombre"
                  />
                </div>

                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>
                    Apellido paterno
                  </span>
                  <input
                    className={styles.editorFloatingInput}
                    value={managerForm.lastName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="Captura el apellido paterno"
                  />
                </div>
              </div>

              <div className={styles.formGridOne}>
                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>
                    Apellido materno
                  </span>
                  <input
                    className={styles.editorFloatingInput}
                    value={managerForm.secondLastName}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        secondLastName: e.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="Captura el apellido materno"
                  />
                </div>
              </div>
            </div>

            <div className={styles.managerSectionCard}>
              <div className={styles.editorSectionTitle}>Contacto</div>

              <div className={styles.formGridTwo}>
                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>
                    Correo electrónico
                  </span>
                  <input
                    className={styles.editorFloatingInput}
                    type="email"
                    value={managerForm.email}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="usuario@correo.com"
                  />
                </div>

                <div className={styles.editorFloatingField}>
                  <span className={styles.editorFloatingLabel}>Teléfono</span>
                  <input
                    className={styles.editorFloatingInput}
                    value={managerForm.phone}
                    onChange={(e) =>
                      setManagerForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="Captura el teléfono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.uploadSheetFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar responsable"}
          </button>
        </div>
      </div>
    </div>
  );
}