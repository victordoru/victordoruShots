import { Link } from "react-router-dom";
import PropTypes from 'prop-types';
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export const metadata = {
  title: "Sign Up - Simple",
  description: "Page description",
};

export default function SignUp({ 
  redirectTo = null, 
  onClose = () => {}, 
  isModal = false
}) {
  // Estado para manejar los datos del formulario
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Estados para manejar la UI y validaciones
  const [error, setError] = useState(null);          // Mensajes de error
  const [success, setSuccess] = useState(null);      // Mensajes de éxito
  const [showPassword, setShowPassword] = useState(false);  // Control de visibilidad de contraseña
  const [passwordError, setPasswordError] = useState("");   // Errores específicos de contraseña
  const [acceptTerms, setAcceptTerms] = useState(false);    // Aceptación de términos
  const [acceptMarketing, setAcceptMarketing] = useState(false);  // Aceptación de marketing
  const [showForm, setShowForm] = useState(false);   // Control de vista del formulario

  // Hooks de navegación y autenticación
  const navigate = useNavigate();
  const { login } = useAuth();

  // Requisitos de seguridad para la contraseña
  const requirements = [
    { id: 1, text: "Al menos 8 caracteres", test: (value) => value.length >= 8 },
    { id: 2, text: "Contiene al menos una letra mayúscula", test: (value) => /[A-Z]/.test(value) },
    { id: 3, text: "Contiene al menos un número", test: (value) => /\d/.test(value) },
    { id: 4, text: "Contiene al menos un carácter especial", test: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
  ];

  // Manejador de cambios en los campos del formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validación en tiempo real de coincidencia de contraseñas
    if (name === 'confirmPassword' || name === 'password') {
      if (name === 'confirmPassword' && value !== formData.password) {
        setPasswordError('Las contraseñas no coinciden');
      } else if (name === 'password' && value !== formData.confirmPassword && formData.confirmPassword) {
        setPasswordError('Las contraseñas no coinciden');
      } else {
        setPasswordError('');
      }
    }
  };

  // Función para alternar la visibilidad de la contraseña
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // Verifica si se cumplen todos los requisitos de la contraseña
  const allRequirementsMet = requirements.every((req) => req.test(formData.password));

  // Manejador del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones antes de enviar
    if (!acceptTerms) {
      setError("Debes aceptar los términos y condiciones y la política de privacidad");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    // Verifica que la contraseña cumpla todos los requisitos
    const unmetRequirement = requirements.find((req) => !req.test(formData.password));
    if (unmetRequirement) {
      setError("La contraseña no cumple con todos los requisitos.");
      return;
    }

    // Limpia mensajes de error y éxito anteriores
    setPasswordError('');
    setError(null);
    setSuccess(null);

    try {
      // Prepara el payload para el backend
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        redirectTo,
      };

      // Envía la petición al backend
      const response = await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/signup/user`, payload);
      
      if (response.status === 200) {
        // Manejo de respuesta exitosa
        if (response.data.accessToken) {
          await login(response.data.accessToken);
          setSuccess("¡Cuenta creada! Tu sesión está activa.");
          setError(null);
          if (onClose && typeof onClose === 'function') onClose();
          if (redirectTo) navigate(redirectTo);
          else if(!isModal) navigate("/profile");
        } else {
          setError(response.data.message || "Error creando la cuenta. Respuesta inesperada.");
        }
      } else {
        setError(response.data.message || "Error creando la cuenta.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error creando la cuenta.");
    }
  };

  // Manejador para el inicio de sesión con Google
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { credential } = credentialResponse;
      // Envía el token de Google al backend
      const response = await axios.post(
        `${import.meta.env.VITE_URL_BACKEND}/api/auth/google/user`,
        { token: credential },
        { withCredentials: true }
      );
      // Realiza el login con el token recibido
      await login(response.data.accessToken);
      if (redirectTo) {
        console.log("redirectTo", redirectTo);
        //navigate(redirectTo);
        onClose();  // Cierra el modal si existe
      } else {
        navigate("/profile");  // Redirección por defecto
      }
    } catch (err) {
      console.error("Google login failed:", err);
      setError("Google login failed");
    }
  };

  // Manejador de error en el login con Google
  const handleGoogleFailure = () => setError("Google login failed");

  return (
    <>
      {/* Vista inicial con opciones de registro */}
      {!showForm ? (
        <div className="space-y-4">
          {/* Encabezado y título */}
          <div className="mb-8 max-w-[500px]">
            <h1 className="text-5xl font-extrabold hidden bg-gradient-to-r from-coral to-red-600 bg-clip-text text-transparent drop-shadow-sm">¡Bienvenido a Winto!</h1>
            <h2 className={`mt-2 text-3xl font-bold text-black ${isModal ? "text-center" : " text-center"}`}>Aquí comienza tu aventura en 
             <img src="/winto.png" alt="Winto" className="inline mx-auto" style={{ height: '26px', margin: '0 0 6px 5px' }} /></h2>
            {/* Mensaje promocional para modal */}
            {isModal && (
              <p className="text-lg font-light text-center mt-4 bg-transparent outline outline-1 outline-coral text-coral italic p-4 rounded">
                ¡Únete ahora y descubre un mundo de eventos! Compra tickets al instante, guarda tus favoritos y disfruta sin complicaciones.
              </p>
            )}
          </div>

          {/* Separador visual */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className={`${isModal ? "bg-white" : "bg-[#f9f9f9]"} px-4 text-sm text-gray-500`}>Regístrate con</span>
            </div>
          </div>

          {/* Opciones de registro */}
          <div className="space-y-4">
            {/* Botón de registro con Google */}
            <div className="text-center text-sm italic text-gray-400">eooo</div>
            <div className="w-full">
              <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                <GoogleLogin 
                  width="383px"
                  onSuccess={handleGoogleSuccess} 
                  onError={handleGoogleFailure}
                  text="signup_with"
                  shape="rectangular"
                  theme="outline"
                  size="large"
                  locale="es"
                />
              </GoogleOAuthProvider>
            </div>

            {/* Separador visual */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className={`${isModal ? "bg-white" : "bg-[#f9f9f9]"} px-4 text-sm text-gray-500`}>O</span>
              </div>
            </div>

            {/* Botón para mostrar formulario de registro con email */}
            <button 
              onClick={() => setShowForm(true)}
              className="w-full py-3 px-4 rounded-md text-white bg-coral hover:bg-red-500 focus:ring-2 focus:ring-coral"
            >
              Registrarse con un correo electrónico
            </button>
          </div>
          
          {/* Enlace para iniciar sesión */}
          <div className="mt-6 text-center">
            <p>¿Ya tienes una cuenta?{" "}
              <Link
                className="text-gray-700 underline hover:no-underline"
                to="/signin"
              >
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Botón para volver a la vista anterior */}
          <div className="mb-4">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-700 hover:underline"
            >
              &larr; Volver
            </button>
          </div>
          
          {/* Encabezado del formulario */}
          <div className="mb-8 max-w-[500px]">
            <h1 className="text-5xl font-extrabold hidden bg-gradient-to-r from-coral to-red-600 bg-clip-text text-transparent drop-shadow-sm">¡Bienvenido a Winto!</h1>
            <h2 className="mt-2 text-3xl font-semibold text-black">Completa tu registro en
             <img src="/winto.png" alt="Winto" className="inline" style={{ height: '26px', margin: '0 0 -4px 5px' }} /></h2>
            {/* Mensaje promocional para modal */}
            {isModal && (
              <p className="text-lg font-light text-center mt-4 bg-transparent outline outline-1 outline-coral text-coral italic p-4 rounded">
                ¡Únete ahora y descubre un mundo de eventos! Compra tickets al instante, guarda tus favoritos y disfruta sin complicaciones.
              </p>
            )}
          </div>

          {/* Mensajes de estado */}
          {success && <p className="text-green-600 text-center mb-4">{success}</p>}
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {/* Formulario de registro */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Campo de nombre */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="name"
                >
                  Nombre
                </label>
                <input
                  id="name"
                  name="name"
                  className="form-input w-full py-2 rounded-lg border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"
                  type="text"
                  /* placeholder="Corey Barker" */
                  required
                  onChange={handleChange}
                />
              </div>

              {/* Campo de email */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  className="form-input w-full py-2 rounded-lg border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"              type="email"
                  /* placeholder="corybarker@email.com" */
                  required
                  onChange={handleChange}
                />
              </div>

              {/* Campo de contraseña con visibilidad toggle */}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="password"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    className="form-input w-full py-2 rounded-lg border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"   
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Campo de confirmación de contraseña */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
                  Confirmar Contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  className="form-input w-full py-2 rounded-lg border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"
                  type="password"
                  required
                  onChange={handleChange}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-1">{passwordError}</p>
                )}
              </div>

              {/* Lista de requisitos de contraseña */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-700">Requisitos de la contraseña:</h3>
                <ul className="text-sm space-y-1">
                  {requirements.map((req) => (
                    <li
                      key={req.id}
                      className={`flex items-center space-x-2 ${
                        req.test(formData.password) ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      <CheckCircleIcon
                        className={`h-5 w-5 ${
                          req.test(formData.password) ? "text-green-600" : "text-gray-400"
                        }`}
                      />
                      <span>{req.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Checkboxes de términos y marketing */}
              <div className="space-y-3 mt-4">
                {/* Checkbox de términos y condiciones */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="acceptTerms"
                      name="acceptTerms"
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={() => setAcceptTerms(!acceptTerms)}
                      className="h-4 w-4 text-coral border-gray-300 rounded focus:ring-coral"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="acceptTerms" className="font-medium text-gray-700">
                      Acepto los{" "}
                      <Link to="/legal/terms" className="text-coral hover:underline">
                        Términos y Condiciones
                      </Link>{" "}
                      y la{" "}
                      <Link to="/legal/privacy" className="text-coral hover:underline">
                        Política de Privacidad
                      </Link>
                    </label>
                    <p className="text-xs text-gray-500">* Campo obligatorio</p>
                  </div>
                </div>

                {/* Checkbox de marketing */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="acceptMarketing"
                      name="acceptMarketing"
                      type="checkbox"
                      checked={acceptMarketing}
                      onChange={() => setAcceptMarketing(!acceptMarketing)}
                      className="h-4 w-4 text-coral border-gray-300 rounded focus:ring-coral"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="acceptMarketing" className="font-medium text-gray-700">
                      Deseo recibir información sobre eventos, ofertas exclusivas y novedades
                    </label>
                    <p className="text-xs text-gray-500">Puedes darte de baja en cualquier momento</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-6 space-y-3">
              {/* Botón de registro */}
              <button
                type="submit"
                className={`btn w-full py-3 px-4 rounded-md text-white ${
                  allRequirementsMet && acceptTerms
                    ? "bg-coral hover:bg-red-500 focus:ring-2 focus:ring-coral"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                disabled={!allRequirementsMet || !acceptTerms}
              >
                Registrarse
              </button>

              <div className="text-center text-sm italic text-gray-400">O</div>

              {/* Botón de registro con Google */}
              <div className="w-full">
                <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                  <GoogleLogin 
                    width="383px"
                    onSuccess={handleGoogleSuccess} 
                    onError={handleGoogleFailure}
                    text="signup_with"
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    locale="es"
                  />
                </GoogleOAuthProvider>
              </div>
            </div>
          </form>

          {/* Enlace para iniciar sesión */}
          <div className={`mt-6 text-center`}>
            <p>¿Ya tienes una cuenta?{" "}
              <Link
                className="text-gray-700 underline hover:no-underline"
                to="/signin"
              >
                Iniciar sesión
              </Link>
            </p>
          </div>
        </>
      )}
    </>
  );
}

// Definición de PropTypes para validación de tipos
SignUp.propTypes = {
  redirectTo: PropTypes.string,
  onClose: PropTypes.func,
  isModal: PropTypes.bool,
};
