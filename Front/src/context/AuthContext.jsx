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
        console.log("[Auth] fetchProfile: start");
        setIsLoading(true); 
        try {
            const response = await api.get("/user/profile");
            console.log("[Auth] fetchProfile: success", response.data);
            setProfile(response.data); // Actualiza el perfil en el contexto
        } catch (err) {
            console.error("[Auth] fetchProfile: error", err);
            //logout();
        } finally {
            console.log("[Auth] fetchProfile: end (setIsLoading false)");
            setIsLoading(false);
        }
    };

    const checkAuth = async () => {
        console.log("[Auth] checkAuth: start");
        setIsLoading(true);
        const savedToken = localStorage.getItem("authToken");
        console.log("[Auth] checkAuth: savedToken", savedToken ? "found" : "missing");
        if (savedToken) {
            setToken(savedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`; 
            setIsAuthenticated(true);
            console.log("[Auth] checkAuth: token applied, fetching profile");
            await fetchProfile();
        } else {
            console.log("[Auth] checkAuth: no token, cleaning state");
            setIsAuthenticated(false);
            setProfile(null);
            delete api.defaults.headers.common['Authorization'];
        }
        console.log("[Auth] checkAuth: end (setIsLoading false)");
        setIsLoading(false);
    };

    const login = async (newToken) => {
        console.log("[Auth] login: start", { hasToken: Boolean(newToken) });
        setIsLoading(true);
        localStorage.setItem("authToken", newToken);
        setToken(newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setIsAuthenticated(true);
        console.log("[Auth] login: token stored, fetching profile");
        await fetchProfile();
    };
    // Función para refrescar el perfil
    const refreshProfile = async () => {
        if (isAuthenticated) { 
            console.log("[Auth] refreshProfile: auth true -> fetching profile");
            await fetchProfile();
        } 
    };
    const logout = async () => {
        console.log("[Auth] logout: start");
        setIsLoading(true);
        localStorage.removeItem("authToken");
        setToken(null);
        setIsAuthenticated(false);
        setProfile(null);
        delete api.defaults.headers.common['Authorization'];
        try {
            await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/logout/`, {}, { withCredentials: true });
        } catch (error) {
            console.error("[Auth] logout: API call failed", error);
        }
        navigate("/signin"); // Redirigir a la página de login
        console.log("[Auth] logout: redirect to /signin");
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
        console.log("[Auth] useEffect init: calling checkAuth");
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
