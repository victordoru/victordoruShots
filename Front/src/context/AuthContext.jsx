import { createContext, useContext, useState, useEffect } from "react";
import PropTypes from 'prop-types';
import api, {setLogout} from "@/utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import axios from "axios"

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Manejar carga inicial
    const [profile, setProfile] = useState(null); // Estado del perfil del usuario

    const navigate = useNavigate(); // Hook para redirigir


    const fetchProfile = async () => {
        setIsLoading(true); 
        try {
            const response = await api.get("/user/profile");
            console.log("perfil");
            console.log(response.data);
            setProfile(response.data); // Actualiza el perfil en el contexto
        } catch (err) {
            console.error("Error fetching profile:", err);
            //logout();
        } finally {
            setIsLoading(false);
        }
    };

    const checkAuth = async () => {
        setIsLoading(true);
        const savedToken = localStorage.getItem("authToken");
        if (savedToken) {
            setToken(savedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`; 
            setIsAuthenticated(true);
            await fetchProfile();
        } else {
            setIsAuthenticated(false);
            setProfile(null);
            delete api.defaults.headers.common['Authorization'];
        }
        setIsLoading(false);
    };

    const login = async (newToken) => {
        setIsLoading(true);
        localStorage.setItem("authToken", newToken);
        setToken(newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setIsAuthenticated(true);
        await fetchProfile();
    };
    // Función para refrescar el perfil
    const refreshProfile = async () => {
        if (isAuthenticated) { 
            await fetchProfile();
        } 
    };
    const logout = async () => {
        setIsLoading(true);
        localStorage.removeItem("authToken");
        setToken(null);
        setIsAuthenticated(false);
        setProfile(null);
        delete api.defaults.headers.common['Authorization'];
        try {
            await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/logout/`, {}, { withCredentials: true });
        } catch (error) {
            console.error("Logout API call failed:", error);
        }
        navigate("/signin"); // Redirigir a la página de login
        setIsLoading(false);
    };
    
    const resendConfirmationLink = async () => {
        if (!profile || !profile.email) {
            console.error("Cannot resend confirmation link: profile or email missing.");
            return { success: false, message: "Error: No se pudo obtener el email del usuario." };
        }
        try {
            await api.post("/auth/send-confirmation-email/user", { email: profile.email });
            return { success: true, message: "Se ha enviado un nuevo enlace de verificación a tu correo." };
        } catch (error) {
            console.error("Error resending confirmation email:", error);
            return { success: false, message: error.response?.data?.message || "Error al reenviar el correo de confirmación." };
        }
    };

    useEffect(() => {
        checkAuth(); // Verifica la autenticación al cargar la app
        setLogout(logout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isEmailConfirmed = profile?.mail_confirmed || false;

    return (
        <AuthContext.Provider value={{ 
            isAuthenticated, 
            token, 
            login, 
            logout, 
            isLoading, 
            profile, 
            setProfile, 
            isEmailConfirmed, 
            refreshProfile,
            resendConfirmationLink
        }}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
