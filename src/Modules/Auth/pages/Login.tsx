import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Login.module.css';
import LogoPresi from '../../../assets/images/logoRGB.png';
import Icono from '../../../assets/images/quetzalcoatl.png';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const Login: React.FC = () => {
  const navigate = useNavigate(); // 👈 router

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulación de login (luego aquí va el backend)
    setTimeout(() => {
      setIsLoading(false);
      navigate('/home'); // 👈 redirección al Home
    }, 1200);
  };

  return (
    <div className={styles.loginContainer}>
      {/* PANEL IZQUIERDO */}
      <div className={styles.leftPanel}>
        <div className={styles.logoCard}>
          <img src={LogoPresi} alt="Tula de Allende" />
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <img src={Icono} alt="Icono" className={styles.formIcon} />

          <h2 className={styles.formTitle}>Iniciar Sesión</h2>
          <div className={styles.underline} />

          <p className={styles.description}>
            Plataforma digital para el crecimiento y desarrollo del municipio
          </p>

          <form onSubmit={handleSubmit}>
            {/* CORREO */}
            <div className={styles.inputWrapper}>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className={styles.icon}>@</span>
            </div>

            {/* CONTRASEÑA */}
            <div className={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className={styles.forgotPassContainer}>
              <a href="#" className={styles.forgotPass}>
                Olvidé contraseña
              </a>
            </div>

            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
