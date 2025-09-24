import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import api from "@/utils/axiosInstance";

const statusOptions = [
  "draft",
  "awaitingPayment",
  "inProgress",
  "complete",
  "cancelled",
];

const shippingMethods = [
  "Budget",
  "Standard",
  "StandardPlus",
  "Express",
  "Overnight",
];

const initialFilters = {
  top: 10,
  skip: 0,
  status: "",
  createdFrom: "",
  createdTo: "",
  orderIds: "",
  merchantReferences: "",
};

const formatDate = (value) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";

const stageBadgeClasses = {
  draft: "bg-gray-500/20 text-gray-200 border-gray-400/40",
  awaitingPayment: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  inProgress: "bg-blue-500/20 text-blue-200 border-blue-400/40",
  complete: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  cancelled: "bg-red-500/20 text-red-200 border-red-400/40",
};

const OrdersManagement = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [ordersData, setOrdersData] = useState({ orders: [], hasMore: false });
  const [loadingList, setLoadingList] = useState(false);
  const [errorList, setErrorList] = useState(null);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderActions, setOrderActions] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState({ success: null, error: null });

  const [shippingUpdate, setShippingUpdate] = useState("Budget");
  const [recipientUpdate, setRecipientUpdate] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    townOrCity: "",
    stateOrCounty: "",
    postalOrZipCode: "",
    countryCode: "",
  });
  const [metadataUpdate, setMetadataUpdate] = useState("{}");
  const [executingAction, setExecutingAction] = useState(false);

  const fetchOrders = useCallback(
    async (overrideFilters) => {
      const query = overrideFilters || filters;
      try {
        setLoadingList(true);
        setErrorList(null);
        const { data } = await api.get("/prodigi/admin/orders", {
          params: query,
        });
        const orders = Array.isArray(data?.orders) ? data.orders : [];
        setOrdersData({ orders, hasMore: Boolean(data?.hasMore) });
      } catch (err) {
        console.error("Error fetching orders", err);
        const message =
          err.response?.data?.error || "No se pudieron cargar las órdenes";
        setErrorList(message);
      } finally {
        setLoadingList(false);
      }
    },
    [filters]
  );

  const fetchOrderDetail = useCallback(
    async (orderId) => {
      if (!orderId) return;
      try {
        setLoadingOrder(true);
        setOrderMessage({ success: null, error: null });
        const [{ data: orderResponse }, { data: actionsResponse }] = await Promise.all([
          api.get(`/prodigi/admin/orders/${orderId}`),
          api.get(`/prodigi/admin/orders/${orderId}/actions`),
        ]);

        setSelectedOrder(orderResponse?.order || orderResponse);
        setOrderActions(actionsResponse);

        // Pre-fill forms based on current data
        const recipient = orderResponse?.order?.recipient;
        if (recipient) {
          setRecipientUpdate({
            name: recipient.name || "",
            email: recipient.email || "",
            phoneNumber: recipient.phoneNumber || "",
            addressLine1: recipient.address?.line1 || "",
            addressLine2: recipient.address?.line2 || "",
            townOrCity: recipient.address?.townOrCity || "",
            stateOrCounty: recipient.address?.stateOrCounty || "",
            postalOrZipCode: recipient.address?.postalOrZipCode || "",
            countryCode: recipient.address?.countryCode || "",
          });
        }
        setShippingUpdate(orderResponse?.order?.shippingMethod || "Budget");
        setMetadataUpdate(
          JSON.stringify(orderResponse?.order?.metadata || {}, null, 2)
        );
      } catch (err) {
        console.error("Error fetching order detail", err);
        const message =
          err.response?.data?.error || "No pudimos cargar el detalle de la orden";
        setOrderMessage({ success: null, error: message });
      } finally {
        setLoadingOrder(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFiltersSubmit = (event) => {
    event.preventDefault();
    setSelectedOrderId(null);
    setSelectedOrder(null);
    fetchOrders(filters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setSelectedOrderId(null);
    setSelectedOrder(null);
    fetchOrders(initialFilters);
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(orderId);
    fetchOrderDetail(orderId);
  };

  const handleAction = async (action, payload) => {
    if (!selectedOrderId) return;
    try {
      setExecutingAction(true);
      setOrderMessage({ success: null, error: null });

      let response;
      switch (action) {
        case "cancel":
          response = await api.post(
            `/prodigi/admin/orders/${selectedOrderId}/actions/cancel`
          );
          break;
        case "shipping":
          response = await api.post(
            `/prodigi/admin/orders/${selectedOrderId}/actions/update-shipping`,
            { shippingMethod: shippingUpdate }
          );
          break;
        case "recipient":
          response = await api.post(
            `/prodigi/admin/orders/${selectedOrderId}/actions/update-recipient`,
            {
              name: recipientUpdate.name,
              email: recipientUpdate.email,
              phoneNumber: recipientUpdate.phoneNumber,
              address: {
                line1: recipientUpdate.addressLine1,
                line2: recipientUpdate.addressLine2,
                townOrCity: recipientUpdate.townOrCity,
                stateOrCounty: recipientUpdate.stateOrCounty,
                postalOrZipCode: recipientUpdate.postalOrZipCode,
                countryCode: recipientUpdate.countryCode,
              },
            }
          );
          break;
        case "metadata":
          let parsedMetadata = {};
          try {
            parsedMetadata = metadataUpdate ? JSON.parse(metadataUpdate) : {};
          } catch (err) {
            setOrderMessage({
              success: null,
              error: "El JSON de metadata no es válido",
            });
            setExecutingAction(false);
            return;
          }
          response = await api.post(
            `/prodigi/admin/orders/${selectedOrderId}/actions/update-metadata`,
            { metadata: parsedMetadata }
          );
          break;
        default:
          throw new Error("Acción no soportada");
      }

      setOrderMessage({
        success: response?.data?.outcome || "Acción ejecutada correctamente",
        error: null,
      });
      fetchOrderDetail(selectedOrderId);
      fetchOrders();
    } catch (err) {
      console.error("Error executing order action", err);
      const message =
        err.response?.data?.error || err.response?.data?.details ||
        err.message ||
        "No se pudo completar la acción";
      setOrderMessage({ success: null, error: message });
    } finally {
      setExecutingAction(false);
    }
  };

  const ordersToDisplay = useMemo(
    () => ordersData.orders || [],
    [ordersData.orders]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 text-white">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold uppercase tracking-[0.4em]">
          Prodigi Orders
        </h1>
        <p className="text-sm text-white/60">
          Gestiona las órdenes enviadas a Prodigi: revisa su estado, acciones disponibles y actualiza su información antes de que entren en producción.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold uppercase tracking-[0.3em] text-white">
          Filtros
        </h2>
        <form
          onSubmit={handleFiltersSubmit}
          className="mt-4 grid gap-4 lg:grid-cols-4"
        >
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Top
            <input
              type="number"
              min="1"
              max="100"
              name="top"
              value={filters.top}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Skip
            <input
              type="number"
              min="0"
              name="skip"
              value={filters.skip}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Estado
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Creada desde
            <input
              type="datetime-local"
              name="createdFrom"
              value={filters.createdFrom}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Creada hasta
            <input
              type="datetime-local"
              name="createdTo"
              value={filters.createdTo}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60 lg:col-span-2">
            Order Ids (separados por coma)
            <input
              type="text"
              name="orderIds"
              value={filters.orderIds}
              onChange={handleFilterChange}
              placeholder="ord_123, ord_456"
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/60 lg:col-span-2">
            Merchant references
            <input
              type="text"
              name="merchantReferences"
              value={filters.merchantReferences}
              onChange={handleFilterChange}
              placeholder="ref1, ref2"
              className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
            />
          </label>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-white px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-white/80"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-full border border-white/30 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white transition hover:border-white/60 hover:text-white"
            >
              Limpiar
            </button>
          </div>
        </form>
        {errorList && (
          <p className="mt-3 text-sm text-red-300">{errorList}</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold uppercase tracking-[0.3em] text-white">
              Órdenes ({ordersToDisplay.length})
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>{`Mostrando ${filters.top} · Inicio ${filters.skip}`}</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {loadingList ? (
              <p className="text-sm text-white/60">Cargando órdenes...</p>
            ) : ordersToDisplay.length === 0 ? (
              <p className="text-sm text-white/60">
                No se encontraron órdenes con los filtros actuales.
              </p>
            ) : (
              ordersToDisplay.map((order) => {
                const stage = order.status?.stage;
                const badgeClass = stageBadgeClasses[stage] ||
                  "bg-white/10 text-white/70 border-white/20";
                const isSelected = order.id === selectedOrderId;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleSelectOrder(order.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-white/70 bg-white/10"
                        : "border-white/10 bg-black/20 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white">
                          {order.id}
                        </p>
                        <p className="text-[0.65rem] text-white/40">
                          {formatDate(order.created)} · {order.merchantReference || "sin referencia"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] ${badgeClass}`}
                      >
                        {stage || "Desconocido"}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                      <span>
                        Método: {order.shippingMethod || "—"}
                      </span>
                      <span>
                        Items: {Array.isArray(order.items) ? order.items.length : 0}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50">
            <button
              type="button"
              onClick={() => {
                const nextSkip = Math.max(Number(filters.skip) - Number(filters.top), 0);
                const nextFilters = { ...filters, skip: nextSkip };
                setFilters(nextFilters);
                fetchOrders(nextFilters);
              }}
              disabled={Number(filters.skip) === 0 || loadingList}
              className="rounded-full border border-white/20 px-4 py-2 uppercase tracking-[0.3em] transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => {
                const nextSkip = Number(filters.skip) + Number(filters.top);
                const nextFilters = { ...filters, skip: nextSkip };
                setFilters(nextFilters);
                fetchOrders(nextFilters);
              }}
              disabled={!ordersData.hasMore || loadingList}
              className="rounded-full border border-white/20 px-4 py-2 uppercase tracking-[0.3em] transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10"
            >
              Siguiente
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold uppercase tracking-[0.3em] text-white">
            Detalle de la orden
          </h2>
          {loadingOrder ? (
            <p className="mt-4 text-sm text-white/60">Cargando detalle...</p>
          ) : !selectedOrder ? (
            <p className="mt-4 text-sm text-white/60">
              Selecciona una orden de la lista para ver su información.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Información general
                </h3>
                <div className="mt-2 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                  <span>ID: {selectedOrder.id}</span>
                  <span>Merchant ref: {selectedOrder.merchantReference || "—"}</span>
                  <span>Creada: {formatDate(selectedOrder.created)}</span>
                  <span>Actualizada: {formatDate(selectedOrder.lastUpdated)}</span>
                  <span>Método: {selectedOrder.shippingMethod || "—"}</span>
                  <span>
                    Estado: {selectedOrder.status?.stage || "—"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Destinatario
                </h3>
                <div className="mt-2 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                  <span>Nombre: {selectedOrder.recipient?.name || "—"}</span>
                  <span>Email: {selectedOrder.recipient?.email || "—"}</span>
                  <span>Teléfono: {selectedOrder.recipient?.phoneNumber || "—"}</span>
                  <span>
                    Dirección: {selectedOrder.recipient?.address?.line1 || ""}
                    {selectedOrder.recipient?.address?.line2
                      ? `, ${selectedOrder.recipient.address.line2}`
                      : ""}
                  </span>
                  <span>
                    Ciudad: {selectedOrder.recipient?.address?.townOrCity || "—"}
                  </span>
                  <span>
                    Código postal: {selectedOrder.recipient?.address?.postalOrZipCode || "—"}
                  </span>
                  <span>
                    País: {selectedOrder.recipient?.address?.countryCode || "—"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">Items</h3>
                <div className="mt-2 space-y-2">
                  {(selectedOrder.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60"
                    >
                      <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/50">
                        {item.sku}
                      </p>
                      <p>Cantidad: {item.copies}</p>
                      <p>Estado: {item.status}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Metadata
                </h3>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[0.65rem] text-white/60">
                  {JSON.stringify(selectedOrder.metadata || {}, null, 2)}
                </pre>
              </div>

              {orderMessage.error && (
                <p className="text-xs text-red-300">{orderMessage.error}</p>
              )}
              {orderMessage.success && (
                <p className="text-xs text-emerald-300">{orderMessage.success}</p>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Acciones disponibles
                </h3>
                {!orderActions ? (
                  <p className="mt-2 text-xs text-white/50">
                    No se pudo determinar si hay acciones disponibles.
                  </p>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction("cancel")}
                        disabled={
                          executingAction || orderActions?.cancel?.isAvailable !== "Yes"
                        }
                        className="rounded-full border border-red-300/40 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-red-200 transition hover:border-red-200/80 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                      >
                        Cancelar orden
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction("shipping")}
                        disabled={
                          executingAction ||
                          orderActions?.changeShippingMethod?.isAvailable !== "Yes"
                        }
                        className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                      >
                        Actualizar envío
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction("recipient")}
                        disabled={
                          executingAction ||
                          orderActions?.changeRecipientDetails?.isAvailable !== "Yes"
                        }
                        className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                      >
                        Actualizar destinatario
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction("metadata")}
                        disabled={executingAction}
                        className="rounded-full border border-white/30 px-4 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                      >
                        Actualizar metadata
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Método de envío
                        <select
                          value={shippingUpdate}
                          onChange={(event) => setShippingUpdate(event.target.value)}
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        >
                          {shippingMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Nombre
                        <input
                          value={recipientUpdate.name}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Email
                        <input
                          type="email"
                          value={recipientUpdate.email}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Teléfono
                        <input
                          value={recipientUpdate.phoneNumber}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              phoneNumber: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Dirección línea 1
                        <input
                          value={recipientUpdate.addressLine1}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              addressLine1: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Dirección línea 2
                        <input
                          value={recipientUpdate.addressLine2}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              addressLine2: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Ciudad
                        <input
                          value={recipientUpdate.townOrCity}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              townOrCity: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Provincia/Estado
                        <input
                          value={recipientUpdate.stateOrCounty}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              stateOrCounty: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        Código postal
                        <input
                          value={recipientUpdate.postalOrZipCode}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              postalOrZipCode: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        País
                        <input
                          value={recipientUpdate.countryCode}
                          onChange={(event) =>
                            setRecipientUpdate((prev) => ({
                              ...prev,
                              countryCode: event.target.value.toUpperCase().slice(0, 2),
                            }))
                          }
                          maxLength={2}
                          className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                      Metadata (JSON)
                      <textarea
                        value={metadataUpdate}
                        onChange={(event) => setMetadataUpdate(event.target.value)}
                        rows={6}
                        className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-[0.65rem] text-white focus:border-white/40 focus:outline-none"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OrdersManagement;
