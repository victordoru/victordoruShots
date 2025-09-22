// src/components/GlobalNotifications.js
import React, { useEffect, useState } from 'react';

const GlobalNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [orderCounts, setOrderCounts] = useState({});
    const [retry, setRetry] = useState(1000); // Tiempo de espera inicial para reconexión en ms

    useEffect(() => {
        let eventSource;

        const connect = () => {
            eventSource = new EventSource(`${import.meta.env.VITE_URL_BACKEND}/api/sse/global`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Notificación Global:', data);

                    if (data.type === 'orderCountUpdate') {
                        const { eventId, orderCount } = data.data;
                        setOrderCounts(prev => ({
                            ...prev,
                            [eventId]: orderCount
                        }));
                    } else {
                        setNotifications(prev => [...prev, data]);
                    }
                } catch (error) {
                    console.error('Error al parsear la notificación global:', error);
                }
            };

            eventSource.onerror = (err) => {
                console.error('Error en la conexión SSE Global:', err);
                eventSource.close();
                // Intentar reconectar después de un tiempo
                setTimeout(() => {
                    setRetry(prev => prev * 2); // Incrementar el tiempo de espera
                    connect();
                }, retry);
            };
        };

        connect();

        return () => {
            eventSource.close();
        };
    }, [retry]);

    return (
        <div>
            <h2>Notificaciones Globales</h2>
            <ul>
                {notifications.map((notif, index) => (
                    <li key={index}>{JSON.stringify(notif)}</li>
                ))}
            </ul>

            <h2>Conteo de Órdenes por Evento</h2>
            <ul>
                {Object.entries(orderCounts).map(([eventId, count]) => (
                    <li key={eventId}>Evento {eventId}: {count} órdenes</li>
                ))}
            </ul>
        </div>
    );
};

export default GlobalNotifications;
