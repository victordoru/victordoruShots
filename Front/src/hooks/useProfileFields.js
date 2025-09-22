import { useState, useEffect } from 'react';
import api from '@/utils/axiosInstance';

export const useProfileFields = () => {
  const [profileFields, setProfileFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfileFields = async () => {
      try {
        setLoading(true);
        const response = await api.get('/form-fields/profile');
        setProfileFields(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching profile fields:', err);
        setError('Error al cargar los campos del perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileFields();
  }, []);

  // Función para obtener solo campos recomendados para perfil
  const getRecommendedFields = () => {
    return profileFields.filter(field => field.isRecommendedForProfile);
  };

  return {
    profileFields,
    loading,
    error,
    getRecommendedFields,
  };
};
