import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/SystemConfigurationView.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type SystemConfigurationDto = {
  idConfiguration?: number;
  emailsEnabled: boolean;
  notificationStartDate: string | null;
};

type RequestSuccess<T> = {
  ok: true;
  data: T;
  status: number;
};

type RequestError = {
  ok: false;
  error: string;
  status: number;
};

type FormState = {
  emailsEnabled: boolean;
  notificationStartDate: string;
};

const toInputDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const SystemConfigurationView: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    emailsEnabled: false,
    notificationStartDate: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");

  const showToast = (message: string, type: ToastType = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastOpen(true);
  };

  const canSave = useMemo(() => {
    if (!form.emailsEnabled) return true;
    return form.notificationStartDate.trim().length > 0;
  }, [form]);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);

    try {
      const response = (await requestJson("/api/system-configuration/active", {
        method: "GET",
        headers: {
          ...authHeaders(),
        },
      })) as RequestSuccess<SystemConfigurationDto> | RequestError;

      if (!response.ok) {
        if (response.status === 404) {
          setForm({
            emailsEnabled: false,
            notificationStartDate: "",
          });
          return;
        }

        showToast("No se pudo cargar la configuración actual.", "error");
        return;
      }

      setForm({
        emailsEnabled: response.data.emailsEnabled,
        notificationStartDate: toInputDate(response.data.notificationStartDate),
      });
    } catch (error: unknown) {
      console.error(error);
      showToast("No se pudo cargar la configuración actual.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const handleChangeEmails = (value: boolean) => {
    setForm((prev) => ({
      ...prev,
      emailsEnabled: value,
      notificationStartDate: value ? prev.notificationStartDate : "",
    }));
  };

  const handleChangeDate = (value: string) => {
    setForm((prev) => ({
      ...prev,
      notificationStartDate: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave) {
      showToast(
        "Debes seleccionar la fecha de inicio cuando los correos estén habilitados.",
        "error"
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        emailsEnabled: form.emailsEnabled,
        notificationStartDate:
          form.emailsEnabled && form.notificationStartDate
            ? new Date(`${form.notificationStartDate}T00:00:00`).toISOString()
            : null,
      };

      const response = (await requestJson("/api/system-configuration/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      })) as RequestSuccess<{
        message: string;
        idConfiguration: number;
      }> | RequestError;

      if (!response.ok) {
        showToast("No se pudo guardar la configuración.", "error");
        return;
      }

      showToast("Configuración guardada correctamente.", "success");
      await loadConfiguration();
    } catch (error: unknown) {
      console.error(error);
      showToast("No se pudo guardar la configuración.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(-1)}
          disabled={loading || saving}
        >
          Volver
        </button>

        <div>
          <h1 className={styles.title}>Configuración del sistema</h1>
          <p className={styles.subtitle}>
            Administra el envío de correos y la fecha de inicio de las
            notificaciones.
          </p>
        </div>
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Notificaciones por correo</h2>
          <p className={styles.sectionText}>
            Aquí puedes definir si el sistema enviará correos automáticos y
            desde cuándo estarán habilitados.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.switchRow}>
              <div>
                <span className={styles.label}>
                  Habilitar envío de correos
                </span>
                <p className={styles.helpText}>
                  Activa esta opción para permitir el envío de notificaciones
                  por correo.
                </p>
              </div>

              <button
                type="button"
                className={`${styles.switch} ${
                  form.emailsEnabled ? styles.switchActive : ""
                }`}
                onClick={() => handleChangeEmails(!form.emailsEnabled)}
                aria-pressed={form.emailsEnabled}
                disabled={loading || saving}
              >
                <span className={styles.switchThumb} />
              </button>
            </label>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="notificationStartDate" className={styles.label}>
              Fecha de inicio de notificaciones
            </label>

            <input
              id="notificationStartDate"
              type="date"
              className={styles.input}
              value={form.notificationStartDate}
              onChange={(e) => handleChangeDate(e.target.value)}
              disabled={!form.emailsEnabled || loading || saving}
            />

            <p className={styles.helpText}>
              {form.emailsEnabled
                ? "Selecciona la fecha desde la cual se comenzarán a enviar las notificaciones."
                : "Primero activa el envío de correos para habilitar este campo."}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate(-1)}
            disabled={loading || saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={loading || saving || !canSave}
          >
            {loading
              ? "Cargando..."
              : saving
              ? "Guardando..."
              : "Guardar configuración"}
          </button>
        </div>
      </form>

      <Toast
        open={toastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
};

export default SystemConfigurationView;