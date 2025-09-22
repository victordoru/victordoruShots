import { useState } from "react";
import axios from "axios";

export const metadata = {
    title: "Restablecer Contraseña - Simple",
    description: "Page description",
  };
  
  export default function SendResetPassword() {
    const [form, setForm] = useState({ email: ""});
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    const handleChange = (e) => {
      //Update setform email value
      console.log(form);
      const { name, value} = e.target;
      setForm((prevForm) => ({
        ...prevForm,
        [name]: value,
      }));
    };
  
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.email) {
        setError("Por favor, ingresa tu email para restablecer tu contraseña.");
        return;
      }
      try {
        await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/request-password-reset/user`, { email: form.email });
        setSuccess("Email de restablecimiento enviado. Revisa tu bandeja de entrada.");
        setError(null);
      } catch (err) {
        console.log(err);
        setError("Error al enviar el email de restablecimiento.");
      }
    };
    return (
      <>
        <div className="mb-10">
          <h1 className="text-4xl font-bold">Restablecer contraseña</h1>
        </div>
  
        {/* Form */}
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
                className="form-input w-full py-2 rounded-lg border placeholder:text-gray-300 border-gray-200 focus:border-none focus:ring-1 focus:ring-coral focus:ring-opacity-60 outline-none transition-colors duration-200"
                type="email"
                name="email"
                placeholder="tuemail@gmail.com"
                required
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="mt-6">
            <button type="submit" className="btn w-full bg-coral bg-[length:100%_100%] bg-[bottom] text-white shadow hover:bg-red-500">
              Recuperar contraseña
            </button>
            {error && <p className="text-red-500 text-xs italic">{error}</p>}
            {success && <p className="text-green-500 text-xs italic">{success}</p>}
            
          </div>
        </form>
      </>
    );
  }
  