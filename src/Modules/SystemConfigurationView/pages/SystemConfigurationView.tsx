import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/SystemConfigurationView.module.css";

import Toast from "../../../Components/layout/Toast";
import type { ToastType } from "../../../Components/layout/Toast";
import { requestJson, authHeaders } from "../../../services/api";

type SystemConfigurationStatusDto = {
  status?: boolean;
  date?: string | null;
  Status?: boolean;
  Date?: string | null;
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const plainDate = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(plainDate) ? plainDate : "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value: string): string => {
  if (!value) return "Sin fecha configurada";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";

  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const resolveStatus = (data: SystemConfigurationStatusDto): boolean => {
  if (typeof data.status === "boolean") return data.status;
  if (typeof data.Status === "boolean") return data.Status;
  return false;
};

const resolveDate = (data: SystemConfigurationStatusDto): string | null => {
  return data.date ?? data.Date ?? null;
};

const SystemConfigurationView: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    emailsEnabled: false,
    notificationStartDate: "",
  });

  const [initialForm, setInitialForm] = useState<FormState>({
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

  const hasChanges = useMemo(() => {
    return (
      form.emailsEnabled !== initialForm.emailsEnabled ||
      form.notificationStartDate !== initialForm.notificationStartDate
    );
  }, [form, initialForm]);

  const canSave = useMemo(() => {
    if (!form.emailsEnabled) return true;
    return form.notificationStartDate.trim().length > 0;
  }, [form]);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);

    try {
      const response = (await requestJson("/api/system-configuration/status", {
        method: "GET",
        headers: {
          ...authHeaders(),
        },
      })) as RequestSuccess<SystemConfigurationStatusDto> | RequestError;

      if (!response.ok) {
        showToast("No se pudo cargar la configuración actual.", "error");
        return;
      }

      const nextForm: FormState = {
        emailsEnabled: resolveStatus(response.data),
        notificationStartDate: toInputDate(resolveDate(response.data)),
      };

      setForm(nextForm);
      setInitialForm(nextForm);
    } catch (error) {
      console.error("Error loading configuration:", error);
      showToast("No se pudo cargar la configuración actual.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const handleToggleEmails = () => {
    setForm((prev) => {
      const nextEnabled = !prev.emailsEnabled;

      return {
        ...prev,
        emailsEnabled: nextEnabled,
        notificationStartDate: nextEnabled ? prev.notificationStartDate : "",
      };
    });
  };

  const handleDateChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      notificationStartDate: value,
    }));
  };

  const handleReset = () => {
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave) {
      showToast(
        "Debes seleccionar una fecha de inicio si los correos están habilitados.",
        "error"
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        EmailsEnabled: form.emailsEnabled,
        NotificationStartDate:
          form.emailsEnabled && form.notificationStartDate
            ? `${form.notificationStartDate}T00:00:00`
            : null,
      };

      const response = (await requestJson("/api/system-configuration/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      })) as
        | RequestSuccess<{
            message: string;
            idConfiguration: number;
          }>
        | RequestError;

      if (!response.ok) {
        showToast("No se pudo guardar la configuración.", "error");
        return;
      }

      const savedForm = { ...form };
      setForm(savedForm);
      setInitialForm(savedForm);

      showToast("Configuración guardada correctamente.", "success");

      await loadConfiguration();
    } catch (error) {
      console.error("Error saving configuration:", error);
      showToast("No se pudo guardar la configuración.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(-1)}
            disabled={loading || saving}
          >
            ← Volver
          </button>

          <div className={styles.headerContent}>
            <h1 className={styles.title}>Configuración del sistema</h1>
            <p className={styles.subtitle}>
              Administra el envío de correos automáticos y define desde qué fecha
              estarán habilitadas las notificaciones del sistema.
            </p>
          </div>
        </div>

        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Notificaciones por correo</h2>
              <p className={styles.sectionText}>
                Configura si el sistema enviará correos automáticos y establece
                la fecha de inicio para las notificaciones.
              </p>
            </div>

            <div className={styles.statusBadgeWrap}>
              <span
                className={`${styles.statusBadge} ${
                  form.emailsEnabled
                    ? styles.statusEnabled
                    : styles.statusDisabled
                }`}
              >
                {form.emailsEnabled
                  ? "Correos habilitados"
                  : "Correos deshabilitados"}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.fieldGroup}>
              <div className={styles.switchRow}>
                <div className={styles.switchText}>
                  <span className={styles.label}>Habilitar envío de correos</span>
                  <p className={styles.helpText}>
                    Activa esta opción para permitir que el sistema envíe
                    notificaciones automáticas por correo.
                  </p>
                </div>

                <button
                  type="button"
                  className={`${styles.switch} ${
                    form.emailsEnabled ? styles.switchActive : ""
                  }`}
                  onClick={handleToggleEmails}
                  aria-pressed={form.emailsEnabled}
                  aria-label={
                    form.emailsEnabled
                      ? "Deshabilitar envío de correos"
                      : "Habilitar envío de correos"
                  }
                  disabled={loading || saving}
                >
                  <span className={styles.switchThumb} />
                </button>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="notificationStartDate" className={styles.label}>
                  Fecha de inicio de notificaciones
                </label>

                <input
                  id="notificationStartDate"
                  type="date"
                  className={styles.input}
                  value={form.notificationStartDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={!form.emailsEnabled || loading || saving}
                />

                <p className={styles.helpText}>
                  {form.emailsEnabled
                    ? "Selecciona la fecha desde la cual comenzarán a enviarse las notificaciones."
                    : "Activa primero el envío de correos para habilitar este campo."}
                </p>
              </div>

              <div className={styles.infoPanel}>
                <span className={styles.infoLabel}>Resumen actual</span>

                <div className={styles.infoItem}>
                  <span className={styles.infoItemTitle}>Estado:</span>
                  <span className={styles.infoItemValue}>
                    {form.emailsEnabled ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoItemTitle}>Fecha configurada:</span>
                  <span className={styles.infoItemValue}>
                    {form.emailsEnabled && form.notificationStartDate
                      ? formatDateLabel(form.notificationStartDate)
                      : "No aplica"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleReset}
              disabled={loading || saving || !hasChanges}
            >
              Restablecer
            </button>

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
              disabled={loading || saving || !canSave || !hasChanges}
            >
              {loading
                ? "Cargando..."
                : saving
                ? "Guardando..."
                : "Guardar configuración"}
            </button>
          </div>
        </form>
      </div>

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