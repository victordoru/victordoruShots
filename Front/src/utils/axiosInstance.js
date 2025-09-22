import axios from "axios";
import { refreshAccessToken } from "@/utils/auth";


// Variable para almacenar la función de logout
let logoutFn = () => {};

// Función para establecer la función de logout desde AuthContext
export const setLogout = (fn) => {
    logoutFn = fn;
};


const api = axios.create({
    baseURL: `${import.meta.env.VITE_URL_BACKEND}/api`,
    withCredentials: true, // Permitir cookies HTTP-only
});

// Estado para rastrear si el token ya está siendo renovado
let isRefreshing = false;
let refreshSubscribers = [];

// Función para notificar a todas las solicitudes en espera
const onTokenRefreshed = (newToken) => {
    console.log("Notificando a las solicitudes en espera...");
    refreshSubscribers.forEach((callback) => callback(newToken));
    console.log("Número de solicitudes notificadas:", refreshSubscribers.length);

    refreshSubscribers = [];
};

// Función para agregar solicitudes en espera mientras se renueva el token
const addRefreshSubscriber = (callback) => {
    refreshSubscribers.push(callback);
};

// Interceptor de solicitudes: Agregar el token a las solicitudes
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    //console.log("Headers finales:", config.headers);
    return config;
});


api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es un 401 (Unauthorized)
    if (error.response?.status === 401) {
      // CASO A: primera vez que recibimos un 401 en esta petición
      if (!originalRequest._retry) {
        // Marcamos la petición para que no volvamos a refrescar varias veces
        originalRequest._retry = true;
        console.log("Token no es válido, refrescamos");

        // Creamos la promesa para reintentar la solicitud original
        const retryOriginalRequest = new Promise((resolve, reject) => {
          addRefreshSubscriber(newToken => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });

        // Sólo entramos al bloque de refresh si no hay otro refresh en curso
        if (!isRefreshing) {
          console.log("No está refrescando");
          isRefreshing = true;
          try {
            console.log("Intentamos");
            const newToken = await refreshAccessToken();
            localStorage.setItem("authToken", newToken);

            isRefreshing = false;
            console.log("Token refrescado, recuperamos solicitud");
            onTokenRefreshed(newToken);
          } catch (refreshError) {
            isRefreshing = false;
            console.log("Refresh token failed");
            console.error("Refresh token failed", refreshError);
            localStorage.removeItem("authToken");
            logoutFn(); // Llamar a la función de logout
            return Promise.reject(refreshError);
          }
        }

        // Retornamos la promesa que reintentará la petición cuando se renueve el token
        return retryOriginalRequest;
      } else {
        // CASO B: Ya habíamos marcado _retry => esto significa que ya refrescamos 
        //         y aun así recibimos 401 => Forzamos logout
        console.log("401 tras refrescar, hacemos logout");
        localStorage.removeItem("authToken");
        logoutFn();
      }
    }

    // Si no es un 401, o no corresponde a nuestra lógica de refresh, lo propagamos
    return Promise.reject(error);
  }
);

  
export default api;
