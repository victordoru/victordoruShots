import { Link } from "react-router-dom";
import PropTypes from 'prop-types';

import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

export const metadata = {
  title: "Sign In - Simple",
  description: "Page description",
};


export default function SignIn({ 
  redirectTo = null, 
  onClose = () => {}, 
  isModal = false, 
  onCodeVerificationRequired = () => {} 
}) {
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: type === "checkbox" ? checked : value,
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...form };
      if (isModal) {
        payload.loginMethod = 'modal_code';
      }
      const response = await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/login/user`, payload, { withCredentials: true });
      
      // Successful login, email already confirmed
      await login(response.data.accessToken);
      if (onClose && typeof onClose === 'function') onClose();
      if (redirectTo) {
        navigate(redirectTo); 
      } else {
        navigate("/profile");
      }

    } catch (err) {
      if (isModal && err.response?.data?.requiresEmailVerification && err.response?.data?.verificationType === 'code') {
        // Email not confirmed, and it's a modal login expecting code verification
        setError(err.response.data.message); // Show message like "Email not confirmed. Please verify..."
        onCodeVerificationRequired(err.response.data.email);
      } else {
        setError(err.response?.data?.message || "Login failed");
      }
    }
  };
  const handleGoogleSuccess = async (credentialResponse) => {
    console.log("Credential Response:", credentialResponse); // Log para verificar
    try {
      const { credential } = credentialResponse;
      const response = await axios.post(
        `${import.meta.env.VITE_URL_BACKEND}/api/auth/google/user`,
        { token: credential },
        { withCredentials: true }
      );
      await login(response.data.accessToken);
      if (redirectTo) {
        console.log("redirectTo", redirectTo);
        //navigate(redirectTo);
        onClose();
      } else {
        navigate("/profile");
      }
    } catch (error) {
      console.error("Google login failed:", error);
      setError("Google login failed");
    }
  };



  const handleGoogleFailure = (error) => {
    console.error("Google Login Failed:", error);
    setError("Google login failed");
  };

  return (
    <>
      {!showForm ? (
        <div className="space-y-4">
          <div className="mb-8 max-w-[500px]">
            <h1 className="text-5xl font-extrabold hidden bg-gradient-to-r from-coral to-red-600 bg-clip-text text-transparent drop-shadow-sm">¡Bienvenido a Winto!</h1>
            <h2 className="mt-2 text-3xl font-bold text-black">Bienvenido de nuevo a
             <img src="/winto.png" alt="Winto" className="inline" style={{ height: '26px', margin: '0 0 6px 5px' }} /></h2>
            {isModal && (
              <p className="text-lg font-light text-center mt-4 bg-transparent outline outline-1 outline-coral text-coral italic p-4 rounded">
                Accede para confirmar tu asistencia y registrar tus datos; ¡asegura tu cupo en el evento!
              </p>
            )}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className={`${isModal ? "bg-white" : "bg-[#f9f9f9]"} px-4 text-sm text-gray-500`}>Inicia sesión con</span>
            </div>
          </div>

          <div className="space-y-4">
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
              <GoogleLogin
                width="383px"
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleFailure}
                text="signin_with"
                shape="rectangular"
                theme="outline"
                size="large"
                locale="es"
              />
            </GoogleOAuthProvider>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className={`${isModal ? "bg-white" : "bg-[#f9f9f9]"}  px-4 text-sm text-gray-500`}>O</span>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 px-4 rounded-md text-white bg-coral hover:bg-red-500 focus:ring-2 focus:ring-coral"
            >
              Iniciar sesión con un correo electrónico
            </button>
          </div>
          <div className="mt-6 text-center">
            <p>¿Aún no tienes cuenta?
              <Link
                className="ms-2 text-sm text-gray-700 underline hover:no-underline"
                to="/signup"
              >
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-700 hover:underline"
            >
              &larr; Volver
            </button>
          </div>
          <div className="mb-8 max-w-[500px]">
            <h1 className="text-5xl font-extrabold hidden bg-gradient-to-r from-coral to-red-600 bg-clip-text text-transparent drop-shadow-sm">¡Bienvenido a Winto!</h1>
            <h2 className="mt-2 text-3xl font-semibold text-black">Inicia sesión con tu correo</h2>
            {isModal && (
              <p className="text-lg font-light text-center mt-4 bg-transparent outline outline-1 outline-coral text-coral italic p-4 rounded">
                Accede para confirmar tu asistencia y registrar tus datos; ¡asegura tu cupo en el evento!
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  id="email"
                  className="form-input w-full py-2 rounded-lg placeholder:text-gray-300 border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"
                  type="email"
                  name="email"
                  placeholder="tuemail@gemail.com"
                  required
                  onChange={handleChange}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  id="password"
                  className="form-input placeholder:text-gray-300 w-full py-2 rounded-lg border border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"
                  type="password"
                  name="password"
                  autoComplete="on"
                  placeholder="••••••••"
                  required
                  onChange={handleChange}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="remember"
                    className="form-checkbox"
                    onChange={handleChange}
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
              </div>
            </div>
            <div className="mt-6">
              <button type="submit" className="btn w-full bg-coral bg-[length:100%_100%] bg-[bottom] text-white shadow hover:bg-red-500">
                Iniciar sesión
              </button>
            </div>
            {error && <p className="text-red-500 text-xs italic">{error}</p>}
          </form>

          <div className="mt-6 space-y-3">
            <div className="text-center text-sm italic text-gray-400">O</div>
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
              <GoogleLogin
                width="383px"
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleFailure}
                text="signin_with"
                shape="rectangular"
                theme="outline"
                size="large"
                locale="es"
              />
            </GoogleOAuthProvider>
          </div>

          <div className="mt-6 text-center">
            <Link
              className="text-sm text-gray-700 underline hover:no-underline"
              to="/reset-password"
            >
              Recuperar contraseña
            </Link>
          </div>
        </>
      )}
    </>
  );
}

SignIn.propTypes = {
  redirectTo: PropTypes.string,
  onClose: PropTypes.func,
  isModal: PropTypes.bool,
  onCodeVerificationRequired: PropTypes.func,
};
