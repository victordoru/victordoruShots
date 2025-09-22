// src/pages/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext"; // Se asume que en el contexto se gestiona profile y logout
import api from "@/utils/axiosInstance";
import EventCardProfile from "@/components/EventCardProfile";
import ProfileImageUploader from "@/components/ProfileImageUploader";
import DynamicProfileField from "@/components/DynamicProfileField";
import { useProfileFields } from "@/hooks/useProfileFields";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { InformationCircleIcon } from '@heroicons/react/24/solid'; // Using solid icon

// Añadir constantes para formatear monedas
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

const ProfilePage = () => {
  const { profile, setProfile, isEmailConfirmed, resendConfirmationLink, isLoading: isAuthLoading } = useAuth(); // get isEmailConfirmed, resendConfirmationLink and auth loading status
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false); // This is for page-specific loading, distinct from auth loading
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();
  const [mobileView, setMobileView] = useState("main"); 
  const [isResendingLinkBanner, setIsResendingLinkBanner] = useState(false);
  const [resendLinkStatusBanner, setResendLinkStatusBanner] = useState({ message: '', type: '' });
  
  // Estado para mostrar/ocultar campos opcionales
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  
  // Hook de campos dinámicos del perfil
  const {
    profileFields,
    loading: fieldsLoading,
    error: fieldsError,
    getRecommendedFields,
  } = useProfileFields();
  
  // Efecto para gestionar la visibilidad de campos opcionales según el tamaño de pantalla
  useEffect(() => {
    // Función para establecer visibilidad basada en ancho de pantalla
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setShowOptionalFields(isDesktop);
    };
    
    // Establecer el estado inicial al montar
    handleResize();
    
    // Añadir event listener para actualizar al cambiar tamaño
    window.addEventListener('resize', handleResize);
    
    // Limpiar event listener al desmontar
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Estados para paginación
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [totalSpent, setTotalSpent] = useState(0);
  const [allOrders, setAllOrders] = useState([]); // Todas las órdenes sin paginar
  const PAGE_SIZE = 10; // Tamaño de página para paginación local

  // Modal para datos de facturación
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  // Función para cargar todas las órdenes
  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Obtener todas las órdenes sin parámetros de paginación
      const response = await api.get(`/user/purchases`);
      console.log('response orders',response);
      const data = response.data;
      
      // Verificar la estructura de la respuesta
      if (Array.isArray(data)) {
        // Formato antiguo: array plano de órdenes
        console.warn("API devolviendo formato antiguo de órdenes");
        setAllOrders(data);
        setOrders(data.slice(0, PAGE_SIZE)); // Paginación local
        setPagination({
          currentPage: 1,
          totalPages: Math.ceil(data.length / PAGE_SIZE),
          total: data.length,
          hasNextPage: data.length > PAGE_SIZE,
          hasPrevPage: false
        });
        setTotalSpent(0);
      } else {
        // Nuevo formato: objeto con órdenes, totalSpent y allEventIds
        const { 
          orders: ordersList = [], 
          totalSpent: spent = 0,
          allEventIds = []
        } = data;
        
        setAllOrders(ordersList);
        
        // Aplicar paginación local
        const totalPages = Math.ceil(ordersList.length / PAGE_SIZE);
        setPagination({
          currentPage: 1,
          totalPages: totalPages,
          total: ordersList.length,
          hasNextPage: totalPages > 1,
          hasPrevPage: false
        });
        
        // Mostrar solo la primera página
        setOrders(ordersList.slice(0, PAGE_SIZE));
        setTotalSpent(spent);
        
        // Cargar eventos si hay IDs de eventos
        if (allEventIds.length > 0) {
          loadEvents(allEventIds);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setAllOrders([]);
      setOrders([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
      setTotalSpent(0);
      setLoading(false);
    }
  };
  
  // Función para cargar eventos basados en IDs de ediciones
  const loadEvents = async (eventIds) => {
    try {
      if (!eventIds || eventIds.length === 0) {
        setEvents([]);
        return;
      }
      console.log("eventIds", eventIds);
      
      const eventPromises = eventIds.map(id => 
        api.get(`/events/event/${id}`)
      );
      
      const eventResponses = await Promise.all(eventPromises);
      const eventData = eventResponses.map(res => res.data);
      
      setEvents(eventData);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };
  
  // Manejar cambio de página (paginación local)
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    
    const startIndex = (newPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    
    // Actualizar ordenes visibles para esta página
    setOrders(allOrders.slice(startIndex, endIndex));
    
    // Actualizar estado de paginación
    setPagination(prev => ({
      ...prev,
      currentPage: newPage,
      hasNextPage: newPage < prev.totalPages,
      hasPrevPage: newPage > 1
    }));
  };

  // Cargar órdenes al montar el componente
  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Datos para la información personal (dinámicos)
  const [formData, setFormData] = useState({
    name: "",
    email: "", // Email es primario y no editable
    profilePicture: [], // Debe ser un array para el ImageUploader
    dynamicFields: {}, // key -> value
  });

  // Datos para la facturación
  const [billingData, setBillingData] = useState({
    type: "", // "personal" o "business"
    fiscalName: "",
    taxId: "", // NIF/CIF
    address: "",
    postalCode: "",
    city: "",
    province: "",
    country: "",
    phone: "",
    email: "",
  });

  // Datos para cambiar contraseña
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Requisitos para la contraseña
  const passwordRequirements = [
    { text: "Al menos 8 caracteres", test: (password) => password.length >= 8 },
    { text: "Al menos una letra mayúscula", test: (password) => /[A-Z]/.test(password) },
    { text: "Al menos una letra minúscula", test: (password) => /[a-z]/.test(password) },
    { text: "Al menos un número", test: (password) => /\d/.test(password) },
  ];

  // Estado para mostrar requisitos de contraseña
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Cuando se carga el profile y los profileFields, inicializamos el formulario dinámico
  useEffect(() => {
    if (profile && Array.isArray(profileFields)) {
      // Construir mapa key->value desde options existentes
      const dynamicFromOptions = {};
      if (profile.options && Array.isArray(profile.options)) {
        profile.options.forEach((opt) => {
          if (opt?.key) dynamicFromOptions[opt.key] = opt.value;
        });
      }

      setFormData((prev) => ({
        ...prev,
        name: profile.name || "",
        email: profile.email || "",
        profilePicture: profile.profilePicture ? [profile.profilePicture] : [],
        dynamicFields: dynamicFromOptions,
      }));

      if (profile.billingData) {
        setBillingData({
          type: profile.billingData.type || "",
          fiscalName: profile.billingData.fiscalName || "",
          taxId: profile.billingData.taxId || "",
          address: profile.billingData.address || "",
          postalCode: profile.billingData.postalCode || "",
          city: profile.billingData.city || "",
          province: profile.billingData.province || "",
          country: profile.billingData.country || "",
          phone: profile.billingData.phone || "",
          email: profile.billingData.email || profile.email || "",
        });
      } else {
        setBillingData({
          type: "personal", 
          fiscalName: "",
          taxId: "",
          address: "",
          postalCode: "",
          city: "",
          province: "",
          country: "",
          phone: "",
          email: profile.email || "",
        });
      }
    }
  }, [profile, profileFields]);

  const handleResendVerificationLinkBanner = async () => {
    setIsResendingLinkBanner(true);
    setResendLinkStatusBanner({ message: '', type: '' });
    const result = await resendConfirmationLink();
    setResendLinkStatusBanner({ message: result.message, type: result.success ? 'success' : 'error' });
    setIsResendingLinkBanner(false);
    if (result.success) {
        setTimeout(() => setResendLinkStatusBanner({ message: '', type: '' }), 7000);
    }
  };

  // Manejadores de cambio de input
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Cambio de campos dinámicos
  const handleDynamicFieldChange = (fieldKey, value) => {
    setFormData((prev) => ({
      ...prev,
      dynamicFields: {
        ...prev.dynamicFields,
        [fieldKey]: value,
      },
    }));
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  // Manejador para cambios en datos de facturación
  const handleBillingChange = (e) => {
    setBillingData({ ...billingData, [e.target.name]: e.target.value });
  };

  // Añadir manejador para la imagen de perfil
  const handleProfilePictureChange = (files) => {
    setFormData((prev) => ({
      ...prev,
      profilePicture: files, // El ImageUploader ya devuelve un array
    }));
    console.log("files", files);
    console.log("formDataAAA", formData);
  };

  // Modificar handleSubmit para manejar la imagen y los campos opcionales
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const formDataToSend = new FormData();

      // Añadir solo el nombre como campo independiente
      formDataToSend.append("name", formData.name);

      // Construir options a partir de dynamicFields
      const options = Object.entries(formData.dynamicFields || {})
        .filter(([, value]) => value !== "" && value !== null && value !== undefined)
        .map(([key, value]) => ({ key, value }));

      // Añadir el array de options como JSON string
      formDataToSend.append("options", JSON.stringify(options));

      // Procesar la imagen de perfil
      const profilePictureOld = [];
      const profilePictureNew = [];

      formData.profilePicture.forEach((item) => {
        //console.log('item',item);
        if (typeof item === "string") {
          formDataToSend.append("profilePictureOld", item);
        } else {
          formDataToSend.append("profilePicture", item);
        }
      });

      // Añadir imagen nueva si existe
      if (profilePictureNew.length > 0) {
        formDataToSend.append("profilePicture", profilePictureNew[0]);
      }

      // Añadir URL de imagen existente
      formDataToSend.append("profilePictureOld", profilePictureOld[0] || "");

      console.log(formDataToSend);

      const resp = await api.put(`/user`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setProfile(resp.data);
      setMessage("Perfil actualizado correctamente.");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error actualizando el perfil.");
    } finally {
      setLoading(false);
    }
  };

  // Submit para actualizar la contraseña
  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    // Validar que la contraseña cumpla los requisitos
    const unmetRequirement = passwordRequirements.find(
      (req) => !req.test(passwordData.newPassword)
    );
    
    if (unmetRequirement) {
      setMessage(`Error: ${unmetRequirement.text}`);
      setLoading(false);
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage("Las nuevas contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    
    try {
      // Usar el endpoint de cambio de contraseña
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setMessage("Contraseña actualizada correctamente.");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      console.error("Error updating password:", error);
      setMessage(error.response?.data?.message || "Error actualizando la contraseña.");
    } finally {
      setLoading(false);
    }
  };
  
  // Submit para actualizar datos de facturación
  const handleSubmitBilling = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // Crear un objeto con los datos de facturación
      const billingDataToSend = {
        type: billingData.type || "personal",
        fiscalName: billingData.fiscalName,
        taxId: billingData.taxId,
        address: billingData.address,
        postalCode: billingData.postalCode,
        city: billingData.city,
        province: billingData.province,
        country: billingData.country,
        phone: billingData.phone,
        email: billingData.email || profile.email
      };

      // Enviar los datos al nuevo endpoint para datos de facturación
      const resp = await api.put(`/user/billing`, { billingData: billingDataToSend });
      
      // Actualizar el perfil con los nuevos datos
      setProfile(resp.data);
      setMessage("Datos de facturación actualizados correctamente.");
    } catch (error) {
      console.error("Error updating billing data:", error);
      setMessage("Error actualizando los datos de facturación.");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para verificar si los datos de facturación están completos
  const areBillingDataComplete = () => {
    const requiredFields = ['fiscalName', 'taxId', 'address', 'postalCode', 'city', 'province', 'country'];
    
    if (!billingData.type) return false;
    
    return requiredFields.every(field => billingData[field] && billingData[field].trim() !== '');
  };
  
  // Función para descargar la factura
  const handleDownloadInvoice = async (orderId) => {
    // Verificar si los datos de facturación están completos
    if (!areBillingDataComplete()) {
      // Almacenar el ID del pedido actual y mostrar el modal
      setCurrentOrderId(orderId);
      setBillingModalOpen(true);
      return;
    }
    
    // Si los datos están completos, proceder con la descarga
    downloadInvoice(orderId);
  };
  
  // Función real de descarga
  const downloadInvoice = async (orderId) => {
    try {
      setLoading(true);
      const response = await api.post(
        "/events/get-pdf-ticket",
        { orderId },
        { responseType: "blob" }
      );
      
      // Crear un objeto URL para el blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `factura-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setLoading(false);
    } catch (error) {
      console.error("Error downloading invoice:", error);
      setLoading(false);
    }
  };
  
  // Función para manejar el envío del formulario del modal
  const handleBillingModalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Crear un objeto con los datos de facturación
      const billingDataToSend = {
        type: billingData.type || "personal",
        fiscalName: billingData.fiscalName,
        taxId: billingData.taxId,
        address: billingData.address,
        postalCode: billingData.postalCode,
        city: billingData.city,
        province: billingData.province,
        country: billingData.country,
        phone: billingData.phone,
        email: billingData.email || profile.email
      };

      // Enviar los datos al endpoint para datos de facturación
      const resp = await api.put(`/user/billing`, { billingData: billingDataToSend });
      
      // Actualizar el perfil con los nuevos datos
      setProfile(resp.data);
      
      // Cerrar el modal
      setBillingModalOpen(false);
      
      // Proceder con la descarga
      await downloadInvoice(currentOrderId);
      
    } catch (error) {
      console.error("Error updating billing data:", error);
      setMessage("Error actualizando los datos de facturación.");
    } finally {
      setLoading(false);
    }
  };

  // Función para ver el detalle de un pago
  const handleViewOrderDetail = (order) => {
    setSelectedOrder(order);
    console.log("order", order)
    if (window.innerWidth < 768) {
      setMobileView("payment-detail");
    } else {
      setActiveTab("payment-detail");
    }
  };

  // Función para volver a la lista de pagos
  const handleBackToPayments = () => {
    setSelectedOrder(null);
    if (window.innerWidth < 768) {
      setMobileView("payments");
    } else {
      setActiveTab("payments");
    }
  };

  // Renderizar detalle de un pago (para escritorio y móvil)
  const renderOrderDetail = () => {
    if (!selectedOrder) return null;

    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-6">
          <button 
            onClick={handleBackToPayments}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold ml-2">Detalle del Pago</h2>
        </div>

        {/* Detalles del evento */}
        {selectedOrder.eventInfo && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              {selectedOrder.eventInfo.cover && (
                <img 
                  src={selectedOrder.eventInfo.cover} 
                  alt={selectedOrder.eventInfo.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              )}
              <div>
                <h3 className="text-lg font-medium text-gray-900">{selectedOrder.eventInfo.name}</h3>
                <p className="text-sm text-gray-600">
                  {dayjs(selectedOrder.eventInfo.startDate).format("DD/MM/YYYY")} • {selectedOrder.eventInfo.location}
                </p>
                <button 
                  onClick={() => navigate(`/events/${selectedOrder.eventInfo.id}`)}
                  className="mt-2 text-sm text-coral hover:underline"
                >
                  Ver evento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Información del pago */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium text-gray-900">Información del Pago</h3>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              selectedOrder.status === "paid" 
                ? "bg-green-100 text-green-800" 
                : "bg-yellow-100 text-yellow-800"
            }`}>
              {selectedOrder.status === "paid" ? "Pagado" : "Pendiente"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Número de Orden</p>
              <p className="font-medium">{selectedOrder._id}</p>
            </div>
            <div>
              <p className="text-gray-500">Fecha</p>
              <p className="font-medium">{dayjs(selectedOrder.createdAt).format("DD/MM/YYYY")}</p>
            </div>
            <div>
              <p className="text-gray-500">Método de Pago</p>
              <p className="font-medium">Tarjeta de crédito</p>
            </div>
            <div>
              <p className="text-gray-500">Total</p>
              <p className="font-medium">{formatCurrency(selectedOrder.totalAmount)}</p>
            </div>
          </div>
        </div>

        {/* Desglose de tickets */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">Entradas Compradas</h3>
          <div className="space-y-3">
            {selectedOrder.tickets.map((ticket, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{ticket.name}</h4>
                    <p className="text-sm text-gray-600">
                      {ticket.quantity} {ticket.quantity > 1 ? "entradas" : "entrada"} x {formatCurrency(ticket.price)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(ticket.price * ticket.quantity)}</p>
                </div>
                
                {/* Participantes */}
                {ticket.participants && ticket.participants.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Participantes:</p>
                    <div className="space-y-2">
                      {ticket.participants.map((participant, pIndex) => (
                        <div key={pIndex} className="bg-gray-50 p-2 rounded-md text-sm">
                          <p className="font-medium">{participant.fullName}</p>
                          <p className="text-gray-600">{participant.email}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Botón de descarga de factura */}
        <div className="flex justify-end">
          <button
            onClick={() => handleDownloadInvoice(selectedOrder._id)}
            disabled={loading}
            className="px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors flex items-center gap-2"
          >
            {loading ? "Descargando..." : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar Factura
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Función para renderizar la lista de pagos
  const renderPaymentsList = () => {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        {window.innerWidth < 768 && (
          <div className="flex items-center mb-6">
            <button 
              onClick={() => setMobileView('main')}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold ml-2">Historial de Pagos</h2>
          </div>
        )}

        {/* Mostrar total gastado */}
        {totalSpent > 0 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total gastado:</p>
            <p className="text-xl font-medium text-gray-900">{formatCurrency(totalSpent)}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14v-2a2 2 0 00-2-2H7a2 2 0 00-2 2v2m6-4v-2m6 6H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">No tienes pagos registrados</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {orders.map((order) => (
                <div key={order._id} className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          order.status === "paid" ? "bg-green-500" : "bg-yellow-500"
                        }`}></span>
                        <h3 className="font-medium text-gray-900">
                          Pedido #{order._id.substr(-6)}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {dayjs(order.createdAt).format("DD/MM/YYYY")} • {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleViewOrderDetail(order)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Ver detalles
                      </button>
                      <button
                        onClick={() => handleDownloadInvoice(order._id)}
                        className="px-3 py-1.5 text-sm border border-coral text-coral rounded-lg hover:bg-coral/5"
                      >
                        Descargar
                      </button>
                    </div>
                  </div>

                  {/* Miniatura del evento */}
                  {order.eventInfo && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                      {order.eventInfo.cover && (
                        <img 
                          src={order.eventInfo.cover} 
                          alt={order.eventInfo.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <p className="font-medium text-sm">{order.eventInfo.name}</p>
                        <p className="text-xs text-gray-600">
                          {order.totalItems} {order.totalItems > 1 ? "tipos de entradas" : "tipo de entrada"} • 
                          {order.totalQuantity} {order.totalQuantity > 1 ? "participantes" : "participante"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Controles de paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className={`px-3 py-1 rounded-md ${
                    pagination.hasPrevPage
                      ? "bg-gray-200 hover:bg-gray-300"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Anterior
                </button>
                
                <span className="text-sm text-gray-600">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className={`px-3 py-1 rounded-md ${
                    pagination.hasNextPage
                      ? "bg-gray-200 hover:bg-gray-300"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Renderizar la vista móvil adecuada según el estado mobileView
  const renderMobileView = () => {
    switch(mobileView) {
      case 'personal':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <button 
                onClick={() => setMobileView('main')}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold ml-2">Editar perfil</h2>
            </div>
            
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            
            <form onSubmit={handleSubmitProfile} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Foto de Perfil - Siempre visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto de Perfil
                  </label>
                  <ProfileImageUploader
                    isMultiple={false}
                    maxSizeMB={2}
                    accept="image/*"
                    value={formData.profilePicture}
                    onChange={handleProfilePictureChange}
                  />
                </div>
                {/* Nombre - Siempre visible */}
                <div>
                  <label
                    htmlFor="name-mobile"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name-mobile" // ID único para mobile
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>
                {/* Email - Siempre visible y deshabilitado */}
                <div>
                  <label
                    htmlFor="email-mobile"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email-mobile" // ID único para mobile
                    value={formData.email}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>

              {/* Botón para mostrar/ocultar campos opcionales */}
              <div className="mt-6 mb-4">
                <button 
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="text-coral hover:text-coral/80 font-medium text-sm flex items-center w-full justify-center py-2 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  {showOptionalFields ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      Ocultar información adicional
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Mostrar información adicional
                    </>
                  )}
                </button>
              </div>

              {/* Campos dinámicos opcionales */}
              {showOptionalFields && (
                <div className="grid grid-cols-1 gap-6 pt-4 border-t border-gray-200">
                  {fieldsLoading && (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Cargando campos...</p>
                    </div>
                  )}
                  {fieldsError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-600">Error cargando campos: {fieldsError}</p>
                    </div>
                  )}
                  {!fieldsLoading && !fieldsError && getRecommendedFields().map((field) => (
                    <DynamicProfileField
                      key={field.key}
                      field={field}
                      value={formData.dynamicFields[field.key] || ''}
                      onChange={handleDynamicFieldChange}
                      className="focus:ring-coral focus:border-coral"
                    />
                  ))}
                </div>
              )}
              
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors w-full sm:w-auto"
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'billing':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <button 
                onClick={() => setMobileView('main')}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold ml-2">Datos de Facturación</h2>
            </div>
            
            <div className="bg-coral/5 border-l-4 border-coral/80 p-4 mb-6">
              <p className="text-sm text-coral">
                Completa tus datos de facturación si quieres generar facturas de tus compras. Esta información se utilizará de forma automática cuando solicites una factura.
              </p>
            </div>
            
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            
            <form onSubmit={handleSubmitBilling} className="space-y-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-4">Tipo de Facturación</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="personal"
                      checked={billingData.type === "personal"}
                      onChange={handleBillingChange}
                      className="form-radio h-4 w-4 text-coral"
                    />
                    <span className="ml-2">Particular</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="business"
                      checked={billingData.type === "business"}
                      onChange={handleBillingChange}
                      className="form-radio h-4 w-4 text-coral"
                    />
                    <span className="ml-2">Empresa</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Nombre fiscal/Razón social */}
                <div>
                  <label
                    htmlFor="fiscalName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "Razón Social" : "Nombre Completo"}
                  </label>
                  <input
                    type="text"
                    name="fiscalName"
                    id="fiscalName"
                    value={billingData.fiscalName}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* NIF/CIF */}
                <div>
                  <label
                    htmlFor="taxId"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "CIF" : "NIF/DNI"}
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    id="taxId"
                    value={billingData.taxId}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={billingData.address}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Código Postal */}
                <div>
                  <label
                    htmlFor="postalCode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    id="postalCode"
                    value={billingData.postalCode}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    id="city"
                    value={billingData.city}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Provincia */}
                <div>
                  <label
                    htmlFor="province"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Provincia
                  </label>
                  <input
                    type="text"
                    name="province"
                    id="province"
                    value={billingData.province}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* País */}
                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700"
                  >
                    País
                  </label>
                  <input
                    type="text"
                    name="country"
                    id="country"
                    value={billingData.country}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={billingData.phone}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  />
                </div>

                {/* Email de facturación */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email de Facturación
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={billingData.email}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors"
                >
                  {loading ? "Guardando..." : "Guardar Datos"}
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'settings':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <button 
                onClick={() => setMobileView('main')}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold ml-2">Ajustes</h2>
            </div>
            
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            
            <form onSubmit={handleSubmitPassword} className="space-y-6">
              {/* Contraseña actual */}
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
              </div>
              {/* Nueva contraseña */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  onFocus={() => setShowPasswordRequirements(true)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
                {showPasswordRequirements && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p className="font-medium mb-1">La contraseña debe tener:</p>
                    <ul className="space-y-1 list-disc pl-5">
                      {passwordRequirements.map((req, index) => (
                        <li 
                          key={index}
                          className={req.test(passwordData.newPassword) ? "text-green-600" : ""}
                        >
                          {req.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {/* Confirmar nueva contraseña */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors"
                >
                  {loading ? "Guardando..." : "Actualizar Contraseña"}
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'payments':
        return renderPaymentsList();
      
      case 'payment-detail':
        return renderOrderDetail();
      
      default: // Vista principal
        return (
          <div className="space-y-4 mb-8">
            <div className="bg-white shadow rounded-lg p-6">
              <button
                onClick={() => setMobileView('personal')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 border-l-2  border-coral/80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 pl-2">Editar perfil</span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={() => setMobileView('billing')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 mt-4 border-l-2 border-coral/80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 pl-2">Datos de Facturación</span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={() => setMobileView('settings')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 mt-4 border-l-2 border-coral/80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 pl-2">Ajustes</span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={() => setMobileView('payments')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 mt-4 border-l-2 border-coral/80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-800 pl-2">Historial de Pagos</span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        );
    }
  };

  // Main return statement for ProfilePage
  return (
    <div className="container mx-auto px-4 py-8 pt-20 sm:pt-[120px]">
      {/* Profile Page Specific Email Verification Notice */}
      {!isAuthLoading && profile && !isEmailConfirmed && (
        <div className="mb-6 bg-gradient-to-r from-[#ff5758] to-[#953b3b] text-white p-5 shadow-lg rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start">
            <div className="bg-white/20 p-2 rounded-full mr-3 flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-grow">
              <p className="font-semibold">¡Tu correo electrónico no está verificado!</p>
              <p className="text-sm mt-1 text-gray-100">
                Para asegurar tu cuenta y acceder a todas las funcionalidades de Winto, por favor verifica tu dirección de correo electrónico. 
                Hemos enviado un enlace de confirmación a <span className="font-medium">{profile.email}</span>. Revisa tu bandeja de entrada (y la carpeta de spam).
              </p>
              {resendLinkStatusBanner.message && (
                <p className={`mt-2 text-xs font-medium px-2 py-1 rounded-full inline-block ${resendLinkStatusBanner.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {resendLinkStatusBanner.message}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleResendVerificationLinkBanner}
            disabled={isResendingLinkBanner}
            className="mt-2 sm:mt-0 whitespace-nowrap text-sm font-medium bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors disabled:opacity-70 flex-shrink-0 self-start sm:self-center"
          >
            {isResendingLinkBanner ? 'Reenviando...' : 'Reenviar enlace de verificación'}
          </button>
        </div>
      )}

      {/* Profile Header - Original structure preserved */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 bg-white rounded-lg p-6 shadow-md">
        <div className="flex flex-row items-center gap-6">
          <div className="w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] rounded-full border-4 border-white shadow-lg overflow-hidden">
            {profile && profile.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-coral/20 flex items-center justify-center text-coral font-bold text-3xl">
                {profile ? (profile.name?.charAt(0) || "U") : "U"}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left ">
            <h1 className="text-3xl font-bold text-gray-900">{profile ? profile.name : "Cargando..."}</h1>
            <p className="text-gray-600">{profile ? profile.email : ""}</p>
          </div>
        </div>
      </div>

      {/* Navegación de pestañas - Solo escritorio - Original structure preserved */}
      <div className="hidden md:block mb-8 border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("profile")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "profile"
                ? "border-coral text-coral"
                : "border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Información Personal
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "billing"
                ? "border-coral text-coral"
                : "border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Datos de Facturación
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "settings"
                ? "border-coral text-coral"
                : "border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Ajustes
          </button>
          <button
            onClick={() => { setActiveTab("payments"); setSelectedOrder(null); }}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payments" || activeTab === "payment-detail"
                ? "border-coral text-coral"
                : "border-transparent hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Historial de Pagos
          </button>
        </nav>
      </div>

      {/* Vista móvil - Original structure preserved */}
      <div className="md:hidden">
        {renderMobileView()} 
      </div>

      {/* Vista escritorio - Contenido basado en pestañas - Original structure preserved */}
      <div className="hidden md:block">
        {activeTab === "profile" && (
          <div className="bg-white shadow rounded-lg p-6">
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            <form onSubmit={handleSubmitProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Foto de Perfil - Siempre visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto de Perfil
                  </label>
                  <ProfileImageUploader
                    isMultiple={false}
                    maxSizeMB={2}
                    accept="image/*"
                    value={formData.profilePicture}
                    onChange={handleProfilePictureChange}
                  />
                </div>
                {/* Nombre - Siempre visible */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />

                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mt-5"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    disabled
                  />
                </div>
                </div>
                

              {/* Botón para mostrar/ocultar campos opcionales */}
              <div className="mt-6 mb-4">
                <button 
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="text-coral hover:text-coral/80 font-medium text-sm flex items-center"
                >
                  {showOptionalFields ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      Ocultar información adicional
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Mostrar información adicional
                    </>
                  )}
                </button>
              </div>

              {/* Campos dinámicos opcionales */}
              {showOptionalFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                  {fieldsLoading && (
                    <div className="col-span-full text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Cargando campos...</p>
                    </div>
                  )}
                  {fieldsError && (
                    <div className="col-span-full bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-600">Error cargando campos: {fieldsError}</p>
                    </div>
                  )}
                  {!fieldsLoading && !fieldsError && getRecommendedFields().map((field) => (
                    <DynamicProfileField
                      key={field.key}
                      field={field}
                      value={formData.dynamicFields[field.key] || ''}
                      onChange={handleDynamicFieldChange}
                      className="focus:ring-coral focus:border-coral"
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors"
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Cambiar Contraseña</h2>
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            <form onSubmit={handleSubmitPassword} className="space-y-6 max-w-md">
              {/* Contraseña actual */}
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
              </div>
              {/* Nueva contraseña */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  onFocus={() => setShowPasswordRequirements(true)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
                {showPasswordRequirements && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p className="font-medium mb-1">La contraseña debe tener:</p>
                    <ul className="space-y-1 list-disc pl-5">
                      {passwordRequirements.map((req, index) => (
                        <li 
                          key={index}
                          className={req.test(passwordData.newPassword) ? "text-green-600" : ""}
                        >
                          {req.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {/* Confirmar nueva contraseña */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors"
                >
                  {loading ? "Guardando..." : "Actualizar Contraseña"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Datos de Facturación</h2>
            
            <div className="bg-coral/5 border-l-4 border-coral/80  p-4 mb-6">
              <p className="text-sm text-coral">
                Completa tus datos de facturación si quieres generar facturas de tus compras. Esta información se utilizará de forma automática cuando solicites una factura.
              </p>
            </div>
            
            {message && (
              <div className={`mb-6 p-3 rounded text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {message}
              </div>
            )}
            
            <form onSubmit={handleSubmitBilling} className="space-y-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Facturación</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="personal"
                      checked={billingData.type === "personal"}
                      onChange={handleBillingChange}
                      className="form-radio h-4 w-4 text-coral"
                    />
                    <span className="ml-2">Particular</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="business"
                      checked={billingData.type === "business"}
                      onChange={handleBillingChange}
                      className="form-radio h-4 w-4 text-coral"
                    />
                    <span className="ml-2">Empresa</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Nombre fiscal/Razón social */}
                <div>
                  <label
                    htmlFor="fiscalName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "Razón Social" : "Nombre Completo"}
                  </label>
                  <input
                    type="text"
                    name="fiscalName"
                    id="fiscalName"
                    value={billingData.fiscalName}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* NIF/CIF */}
                <div>
                  <label
                    htmlFor="taxId"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "CIF" : "NIF/DNI"}
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    id="taxId"
                    value={billingData.taxId}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={billingData.address}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Código Postal */}
                <div>
                  <label
                    htmlFor="postalCode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    id="postalCode"
                    value={billingData.postalCode}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    id="city"
                    value={billingData.city}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Provincia */}
                <div>
                  <label
                    htmlFor="province"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Provincia
                  </label>
                  <input
                    type="text"
                    name="province"
                    id="province"
                    value={billingData.province}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* País */}
                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700"
                  >
                    País
                  </label>
                  <input
                    type="text"
                    name="country"
                    id="country"
                    value={billingData.country}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={billingData.phone}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  />
                </div>

                {/* Email de facturación */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email de Facturación
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={billingData.email}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-coral text-white rounded hover:bg-coral/90 transition-colors"
                >
                  {loading ? "Guardando..." : "Guardar Datos"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "payments" && renderPaymentsList()}
        
        {activeTab === "payment-detail" && renderOrderDetail()}
      </div>

      {/* Sección de Eventos - Mostrar solo en la vista principal en móvil */}
      {(mobileView === 'main' || window.innerWidth >= 768) && activeTab !== "payment-detail" && activeTab !== "payments" && (
        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <h3 className="text-2xl font-semibold mb-6 text-gray-900 italic">Mis Eventos</h3>
          
          {events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((event) => (
                <EventCardProfile key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-10 text-center">
              <p className="text-gray-500 mb-2">No tienes eventos registrados.</p>
              <a href="/events" className="text-coral hover:underline font-medium">Descubrir eventos</a>
            </div>
          )}
        </div>
      )}

      {/* Modal para datos de facturación */}
      {billingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Datos de Facturación Requeridos</h2>
                <button 
                  onClick={() => setBillingModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <p className="text-sm text-yellow-700">
                  Necesitamos tus datos de facturación completos para generar la factura. Por favor completa todos los campos.
                </p>
              </div>
              
              <form onSubmit={handleBillingModalSubmit} className="space-y-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Facturación</label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="personal"
                        checked={billingData.type === "personal"}
                        onChange={handleBillingChange}
                        className="form-radio h-4 w-4 text-coral"
                      />
                      <span className="ml-2">Particular</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="business"
                        checked={billingData.type === "business"}
                        onChange={handleBillingChange}
                        className="form-radio h-4 w-4 text-coral"
                      />
                      <span className="ml-2">Empresa</span>
                    </label>
                  </div>
                </div>

                {/* Nombre fiscal/Razón social */}
                <div>
                  <label
                    htmlFor="modalFiscalName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "Razón Social" : "Nombre Completo"}
                  </label>
                  <input
                    type="text"
                    name="fiscalName"
                    id="modalFiscalName"
                    value={billingData.fiscalName}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* NIF/CIF */}
                <div>
                  <label
                    htmlFor="modalTaxId"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {billingData.type === "business" ? "CIF" : "NIF/DNI"}
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    id="modalTaxId"
                    value={billingData.taxId}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Dirección */}
                <div>
                  <label
                    htmlFor="modalAddress"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="modalAddress"
                    value={billingData.address}
                    onChange={handleBillingChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    required
                  />
                </div>

                {/* Fila para código postal y ciudad */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="modalPostalCode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Código Postal
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      id="modalPostalCode"
                      value={billingData.postalCode}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modalCity"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Ciudad
                    </label>
                    <input
                      type="text"
                      name="city"
                      id="modalCity"
                      value={billingData.city}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                      required
                    />
                  </div>
                </div>

                {/* Fila para provincia y país */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="modalProvince"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Provincia
                    </label>
                    <input
                      type="text"
                      name="province"
                      id="modalProvince"
                      value={billingData.province}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modalCountry"
                      className="block text-sm font-medium text-gray-700"
                    >
                      País
                    </label>
                    <input
                      type="text"
                      name="country"
                      id="modalCountry"
                      value={billingData.country}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                      required
                    />
                  </div>
                </div>

                {/* Fila para teléfono y email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="modalPhone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="modalPhone"
                      value={billingData.phone}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="modalEmail"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="modalEmail"
                      value={billingData.email}
                      onChange={handleBillingChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-coral focus:border-coral"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setBillingModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-coral text-white rounded-md shadow-sm text-sm font-medium hover:bg-coral/90"
                  >
                    {loading ? "Procesando..." : "Guardar y Continuar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
