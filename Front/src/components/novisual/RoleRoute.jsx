import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import Loader from "@/components/Loader";

const RoleRoute = ({ roles, children }) => {
  const { isLoading, isAuthenticated, profile } = useAuth();

  if (isLoading) {
    return <Loader />;
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/signin" />;
    }
  // Chequea si el rol del user está en el array de roles permitidos
  if (!roles.includes(profile?.role)) {
    // O redirecciona a un "Unauthorized" o muestra un mensaje
    console.log("No tienes permisos para ver esta página");
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default RoleRoute;
