

export default function SinAcceso() {


  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <h1 style={{ marginBottom: "12px" }}>Sin acceso a módulos</h1>
        <p style={{ marginBottom: "24px", color: "#475569" }}>
          Tu usuario está registrado, pero no tiene permisos asignados para visualizar módulos.
        </p>

      </div>
    </div>
  );
}