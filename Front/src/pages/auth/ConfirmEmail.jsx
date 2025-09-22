import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

const ConfirmEmailPage = () => {
  const { token, type } = useParams(); // Por ejemplo, /confirm-email/:type/:token
  const [message, setMessage] = useState("Confirmando email...");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const confirmationAttempted = useRef(false);

  // Leer el parámetro redirect de la query string
  const query = new URLSearchParams(location.search);
  const redirectTo = query.get("redirect") || "/profile"; // Valor por defecto

  useEffect(() => {
    const confirmEmail = async () => {
      // Evitar múltiples intentos de confirmación
      if (confirmationAttempted.current) {
        return;
      }
      
      confirmationAttempted.current = true;
      
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_URL_BACKEND}/api/auth/confirm-email/${type}/${token}`
        );
        setMessage(response.data.message);
        if (response.data.accessToken) {
          // Hacer login automáticamente
          await login(response.data.accessToken);
          // Redirigir a la URL que viene en redirect (o a un valor por defecto)
          navigate(redirectTo);
        } else {
          setMessage("Error: No se devolvió access token.");
        }
      } catch {
        // Sin parámetro en el catch para evitar advertencia del linter
        setMessage("Token inválido o expirado.");
        confirmationAttempted.current = false; // Permitir reintento solo en caso de error
      }
    };

    confirmEmail();
  }, [token, type, login, navigate, redirectTo]); // Mantenemos las dependencias necesarias

  return <div>{message}</div>;
};

export default ConfirmEmailPage;
