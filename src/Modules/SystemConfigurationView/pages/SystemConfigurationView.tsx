import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type DatePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 2V5M17 2V5M3 9H21M5 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SystemConfigurationView: React.FC = () => {
  const navigate = useNavigate();
  const dateInputRef = useRef<HTMLInputElement | null>(null);

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
  const handleReset = () => {
    setForm(initialForm);
    showToast("Cambios descartados.", "success");
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

  const currentStatusText = form.emailsEnabled ? "Activo" : "Inactivo";
  const currentDateText =
    form.emailsEnabled && form.notificationStartDate
      ? formatDateLabel(form.notificationStartDate)
      : "No aplica";

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

  const openDatePicker = () => {
    const input = dateInputRef.current as DatePickerInput | null;
    if (!input || input.disabled) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave) {
      showToast(
        "Debes seleccionar una fecha de inicio si los correos están habilitados.",
        "error",
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
      <div className={styles.mainContent}>
        <section className={styles.hero}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Configuración del sistema</h1>
              <p className={styles.subtitle}>
                Administra el envío de correos automáticos y define desde qué
                fecha estarán habilitadas las notificaciones del sistema.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => navigate(-1)}
                disabled={loading || saving}
              >
                Volver
              </button>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={loadConfiguration}
                disabled={loading || saving}
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </section>

        <section className={styles.toolbar}>
          <div className={styles.filters}>
            <span className={styles.filterChip}>
              Estado
              <span className={styles.filterCount}>{currentStatusText}</span>
            </span>

            <span className={styles.filterChip}>
              Fecha
              <span className={styles.filterCount}>{currentDateText}</span>
            </span>

            <span
              className={`${styles.filterChip} ${
                hasChanges ? styles.filterChipWarn : ""
              }`}
            >
              Cambios
              <span className={styles.filterCount}>
                {hasChanges ? "Pendientes" : "Sin cambios"}
              </span>
            </span>
          </div>

          <div className={styles.toolbarActions}>
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
        </section>

        <form className={styles.content} onSubmit={handleSubmit}>
          <div className={styles.contentGrid}>
            <section className={styles.leftColumn}>
              <div className={styles.configCard}>
                <div className={styles.blockHeader}>
                  <span className={styles.blockEyebrow}>
                    Configuración general
                  </span>
                </div>

                <div className={styles.switchRow}>
                  <div className={styles.switchText}>
                    <span className={styles.label}>Habilitar correos</span>
                    <p className={styles.helpText}>
                      Cuando esta opción está activa, el sistema podrá enviar
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

              <div className={styles.configCard}>
                <div className={styles.blockHeader}>
                  <span className={styles.blockEyebrow}>Programación</span>
                  <h2 className={styles.blockTitle}>
                    Fecha de inicio de notificaciones
                  </h2>
                  <p className={styles.blockDescription}>
                    Selecciona desde qué fecha comenzará el envío automático de
                    correos.
                  </p>
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="notificationStartDate"
                    className={styles.label}
                  >
                    Fecha
                  </label>

                  <div className={styles.dateWrap}>
                    <input
                      ref={dateInputRef}
                      id="notificationStartDate"
                      type="date"
                      className={`${styles.input} ${styles.dateInput}`}
                      value={form.notificationStartDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      disabled={!form.emailsEnabled || loading || saving}
                    />

                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={openDatePicker}
                      disabled={!form.emailsEnabled || loading || saving}
                      aria-label="Abrir calendario"
                      title="Seleccionar fecha"
                    >
                      <CalendarIcon />
                    </button>
                  </div>

                  <p className={styles.helpText}>
                    {form.emailsEnabled
                      ? "Selecciona la fecha desde la cual comenzarán a enviarse las notificaciones."
                      : "Activa primero el envío de correos para habilitar este campo."}
                  </p>
                </div>
              </div>
            </section>

            <aside className={styles.rightColumn}>
              <div className={styles.summaryCard}>
                <div className={styles.blockHeader}>
                  <span className={styles.blockEyebrow}>Resumen</span>
                  <h2 className={styles.blockTitle}>Estado actual</h2>
                  <p className={styles.blockDescription}>
                    Vista rápida de la configuración actual del sistema.
                  </p>
                </div>

                <div className={styles.summaryList}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryItemLabel}>
                      Envío de correos
                    </span>
                    <span className={styles.summaryItemValue}>
                      {currentStatusText}
                    </span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryItemLabel}>
                      Fecha configurada
                    </span>
                    <span className={styles.summaryItemValue}>
                      {currentDateText}
                    </span>
                  </div>
                </div>

                <div className={styles.summaryFooter}>
                  <span
                    className={`${styles.miniStatus} ${
                      hasChanges ? styles.miniStatusWarn : styles.miniStatusOk
                    }`}
                  >
                    {hasChanges ? "Hay cambios sin guardar" : "Todo guardado"}
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleReset}
              disabled={loading || saving || !hasChanges}
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
