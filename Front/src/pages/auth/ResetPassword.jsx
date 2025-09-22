import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const navigate = useNavigate();
  const requirements = [
    { id: 1, text: "At least 8 characters", test: (value) => value.length >= 8 },
    { id: 2, text: "Contains at least one uppercase letter", test: (value) => /[A-Z]/.test(value) },
    { id: 3, text: "Contains at least one number", test: (value) => /\d/.test(value) },
    { id: 4, text: "Contains at least one special character", test: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
  ];
  useEffect(() => {
    // Verificar si el token es válido
    const validateToken = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_URL_BACKEND}/api/auth/validate-reset-token/user/${token}`
        );
        setIsTokenValid(true);
        setMessage(response.data.message);
      } catch (err) {
        setIsTokenValid(false);
        setError(err.response?.data?.message || "Invalid or expired token");
      }
    };

    validateToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prevForm) => ({ ...prevForm, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const unmetRequirement = requirements.find((req) => !req.test(form.newPassword));
    if (unmetRequirement) {
      setError("Password does not meet all requirements");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_URL_BACKEND}/api/auth/reset-password/user/${token}`,
        { newPassword: form.newPassword }
      );
      setMessage(response.data.message || "Password reset successfully");
      navigate("/signin");
    } catch (err) {
      setError(err.response?.data?.message || "Error resetting password");
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const allRequirementsMet = requirements.every((req) => req.test(form.newPassword));
  const passwordsMatch = form.newPassword && form.confirmPassword && form.newPassword === form.confirmPassword;
  
  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Reset Password</h1>
          <p className="text-red-600 text-center">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Reset Password</h1>

        {message && <p className="text-green-600 text-center mb-4">{message}</p>}
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                placeholder="Enter your new password"
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              className={`mt-1 block w-full px-4 py-2 border rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 ${
                passwordsMatch || !form.confirmPassword ? "border-gray-300" : "border-red-500"
              }`}
              placeholder="Re-enter your new password"
              required
            />
            {form.confirmPassword && (
              <p className={`mt-1 text-sm ${passwordsMatch ? "text-green-600" : "text-red-600"}`}>
                {passwordsMatch ? "Passwords match" : "Passwords do not match"}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-700">Password requirements:</h3>
            <ul className="text-sm space-y-1">
              {requirements.map((req) => (
                <li
                  key={req.id}
                  className={`flex items-center space-x-2 ${
                    req.test(form.newPassword) ? "text-green-600" : "text-gray-500"
                  }`}
                >
                  <CheckCircleIcon
                    className={`h-5 w-5 ${
                      req.test(form.newPassword) ? "text-green-600" : "text-gray-400"
                    }`}
                  />
                  <span>{req.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-md shadow-sm text-white ${
              allRequirementsMet && passwordsMatch
                ? "bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={!allRequirementsMet || !passwordsMatch}
          >
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
