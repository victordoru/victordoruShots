import axios from "axios";

export const refreshAccessToken = async () => {
    try {
        const response = await axios.post(`${import.meta.env.VITE_URL_BACKEND}/api/auth/refresh`, {}, {withCredentials: true});
        return response.data.accessToken;
    } catch (err) {
        console.error("Error refreshing token", err);
        throw err; 
    }
};
