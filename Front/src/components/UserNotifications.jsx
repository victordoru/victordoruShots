// src/components/UserNotifications.js
import React, { useEffect, useState } from 'react';
import api from "@/utils/axiosInstance";


const UserNotifications = () => {
    const [eventOrderCounts, setEventOrderCounts] = useState({}); // Para almacenar orderCount por eventId

    useEffect(() => {
        const token = localStorage.getItem('authToken'); // Asegúrate de que este es el nombre correcto
        if (!token) {
            console.log('Usuario no autenticado');
            return;
        }  
        //Para rutas protegidas: const resp = await api.post(`${import.meta.env.VITE_URL_BACKEND}/api/sse/user`);
        const eventSource = new EventSource(`${import.meta.env.VITE_URL_BACKEND}/api/sse/user`, { withCredentials: true });

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Notificación de Usuario:', data);

                const { eventId, orderCount } = data;
                setEventOrderCounts(prev => ({
                    ...prev,
                    [eventId]: orderCount
                }));
            } catch (error) {
                console.error('Error al parsear la notificación de usuario:', error);
            }
        };

        eventSource.onerror = (err) => {
            console.error('Error en la conexión SSE Usuario:', err);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    return (
        <div>
            <h2>Notificaciones de Usuario</h2>
            <ul>
                {Object.entries(eventOrderCounts).map(([eventId, count]) => (
                    <li key={eventId}>Evento {eventId}: {count} órdenes</li>
                ))}
            </ul>
        </div>
    );
};

export default UserNotifications;
