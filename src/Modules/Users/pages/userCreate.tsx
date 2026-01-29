import { useMemo, useState } from "react";
import styles from "../styles/userCreate.module.css";

type RoleValue =
  | "ADMIN"
  | "TESORERIA"
  | "ADQUISICIONES"
  | "PRESIDENCIA"
  | "CAPTURISTA"
  | "CONSULTA";

type AreaValue =
  | "TESORERIA"
  | "ADQUISICIONES"
  | "PRESIDENCIA"
  | "CONTRALORIA"
  | "SISTEMAS";

type FormState = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  username: string;
  email: string;
  rol: RoleValue;
  area: AreaValue;
  activo: boolean;
  password: string;
  password2: string;
};

type ApiError = { message?: string };

const initialForm: FormState = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  username: "",
  email: "",
  rol: "CAPTURISTA",
  area: "TESORERIA",
  activo: true,
  password: "",
  password2: "",
};

export default function UserCreate() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const roles = useMemo(
    () => [
      { value: "ADMIN" as const, label: "Administrador" },
      { value: "TESORERIA" as const, label: "Tesorería" },
      { value: "ADQUISICIONES" as const, label: "Adquisiciones" },
      { value: "PRESIDENCIA" as const, label: "Presidencia" },
      { value: "CAPTURISTA" as const, label: "Capturista" },
      { value: "CONSULTA" as const, label: "Consulta" },
    ],
    []
  );

  const areas = useMemo(
    () => [
      { value: "TESORERIA" as const, label: "Tesorería" },
      { value: "ADQUISICIONES" as const, label: "Adquisiciones" },
      { value: "PRESIDENCIA" as const, label: "Presidencia" },
      { value: "CONTRALORIA" as const, label: "Contraloría" },
      { value: "SISTEMAS" as const, label: "Sistemas" },
    ],
    []
  );

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate(): string {
    if (!form.nombre.trim()) return "El nombre es obligatorio.";
    if (!form.username.trim()) return "El usuario es obligatorio.";
    if (!form.email.trim()) return "El correo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Correo inválido.";
    if (!form.password) return "La contraseña es obligatoria.";
    if (form.password.length < 8) return "Mínimo 8 caracteres.";
    if (form.password !== form.password2) return "Las contraseñas no coinciden.";
    return "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);
    setError("");
    setOk("");

    const payload = {
      nombre: form.nombre.trim(),
      apellidoPaterno: form.apellidoPaterno.trim(),
      apellidoMaterno: form.apellidoMaterno.trim(),
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      rol: form.rol,
      area: form.area,
      activo: form.activo,
      password: form.password,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await safeJson<ApiError>(res)) ?? {};
        throw new Error(data.message || "No se pudo crear el usuario.");
      }

      setOk("Usuario creado correctamente.");
      setForm(initialForm);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setError("");
    setOk("");
    setForm(initialForm);
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>Datos del usuario</p>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={styles.grid}>
            <Field label="Nombre" required>
              <input name="nombre" value={form.nombre} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Apellido paterno">
              <input name="apellidoPaterno" value={form.apellidoPaterno} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Apellido materno">
              <input name="apellidoMaterno" value={form.apellidoMaterno} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Usuario" required>
              <input name="username" value={form.username} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Correo" required>
              <input type="email" name="email" value={form.email} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Rol" required>
              <select name="rol" value={form.rol} onChange={onChange} className={styles.input} disabled={saving}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Área" required>
              <select name="area" value={form.area} onChange={onChange} className={styles.input} disabled={saving}>
                {areas.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Activo">
  <label className={styles.switch}>
    <input
      type="checkbox"
      checked={form.activo}
      onChange={() => setForm((p) => ({ ...p, activo: !p.activo }))}
      disabled={saving}
    />
    <span className={styles.slider}></span>
  </label>
</Field>


            <Field label="Contraseña" required>
              <input type="password" name="password" value={form.password} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>

            <Field label="Confirmar contraseña" required>
              <input type="password" name="password2" value={form.password2} onChange={onChange} className={styles.input} disabled={saving} />
            </Field>
          </div>

          {(error || ok) && (
            <div className={error ? styles.alertError : styles.alertOk}>
              {error || ok}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onReset} disabled={saving}>
              Limpiar
            </button>

            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Guardando..." : "Guardar usuario"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
};

function Field({ label, required = false, children }: FieldProps) {
  return (
    <div>
      <div className={styles.labelRow}>
        <label className={styles.label}>{label}</label>
        {required && <span className={styles.required}>*</span>}
      </div>
      {children}
    </div>
  );
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
