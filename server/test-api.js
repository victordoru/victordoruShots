const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { prodigiRequest, PRODIGI_BASE_URL } = require("./utils/prodigiClient");

const resolveSku = (explicit) =>
  explicit || process.env.PRODIGI_TEST_SKU || "GLOBAL-CAN-10x10";

const resolveOrderId = (explicit) =>
  explicit || process.env.PRODIGI_TEST_ORDER_ID || null;

const logJSON = (label, payload) => {
  console.log(`\n${label}`);
  console.log(`Base URL: ${PRODIGI_BASE_URL}`);
  console.log(JSON.stringify(payload, null, 2));
};

const handleError = (error) => {
  console.error("\nFallo en la petición Prodigi:");
  if (error.status) {
    console.error(`Status: ${error.status}`);
  }
  if (error.data) {
    console.error(JSON.stringify(error.data, null, 2));
  } else {
    console.error(error.message);
  }
  process.exit(1);
};

const runGetProductDetails = async (skuArg) => {
  const sku = resolveSku(skuArg);
  console.log(`Consultando detalles de producto para SKU "${sku}"...`);
  const product = await prodigiRequest(`/products/${encodeURIComponent(sku)}`);
  logJSON("Product details", product);
};

const runListProducts = async () => {
  console.log("Listando productos disponibles...");
  const products = await prodigiRequest("/products");
  logJSON("Products", products);
};

const runGetQuotePreview = async (skuArg) => {
  const sku = resolveSku(skuArg);
  const assetUrl = process.env.PRODIGI_TEST_ASSET_URL;

  if (!assetUrl) {
    throw new Error(
      "Configura PRODIGI_TEST_ASSET_URL en server/.env con una URL pública a tu asset"
    );
  }

  const payload = {
    shippingMethod: process.env.PRODIGI_TEST_SHIPPING_METHOD || "Budget",
    destinationCountryCode: process.env.PRODIGI_TEST_COUNTRY || "ES",
    items: [
      {
        sku,
        copies: Number(process.env.PRODIGI_TEST_COPIES || 1),
        attributes: {
          paperType: "SAP",
          substrateWeight: "240gsm"
        },
        assets: [
          {
            printArea: "default",
          },
        ],
      },
    ],
  };

  console.log("Solicitando preview de cotización...");
  const quote = await prodigiRequest("/Quotes", {
    method: "POST",
    body: payload,
  });
  logJSON("Quote", quote);
};

const parseQueryArg = (arg) => {
  if (!arg) return {};
  try {
    const parsed = JSON.parse(arg);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    console.warn("No se pudo parsear el JSON de filtros, se ignora", err.message);
  }
  return {};
};

const buildQueryString = (query = {}) => {
  const params = new URLSearchParams();

  const top = Number(query.top);
  if (!Number.isNaN(top) && top >= 1 && top <= 100) {
    params.set("top", top);
  }

  const skip = Number(query.skip);
  if (!Number.isNaN(skip) && skip >= 0) {
    params.set("skip", skip);
  }

  if (query.createdFrom) {
    params.set("createdFrom", String(query.createdFrom));
  }

  if (query.createdTo) {
    params.set("createdTo", String(query.createdTo));
  }

  if (query.status) {
    params.set("status", String(query.status));
  }

  const orderIds = Array.isArray(query.orderIds)
    ? query.orderIds
    : query.orderIds
    ? String(query.orderIds)
        .split(/[,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  orderIds.forEach((id) => params.append("orderIds", id));

  const merchantReferences = Array.isArray(query.merchantReferences)
    ? query.merchantReferences
    : query.merchantReferences
    ? String(query.merchantReferences)
        .split(/[,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  merchantReferences.forEach((ref) => params.append("merchantReferences", ref));

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
};

const runListOrders = async (queryArg) => {
  console.log("Listando órdenes de Prodigi...");
  const query = parseQueryArg(queryArg);
  const queryString = buildQueryString(query);
  const response = await prodigiRequest(`/Orders${queryString}`);
  logJSON("Orders", response);
};

const runGetOrder = async (orderIdArg) => {
  const orderId = resolveOrderId(orderIdArg);
  if (!orderId) {
    throw new Error(
      "Debes pasar un orderId como argumento o configurar PRODIGI_TEST_ORDER_ID"
    );
  }

  console.log(`Consultando orden ${orderId}...`);
  const response = await prodigiRequest(
    `/Orders/${encodeURIComponent(orderId)}`
  );
  logJSON("Order", response);
};

const runGetOrderActions = async (orderIdArg) => {
  const orderId = resolveOrderId(orderIdArg);
  if (!orderId) {
    throw new Error(
      "Debes pasar un orderId como argumento o configurar PRODIGI_TEST_ORDER_ID"
    );
  }

  console.log(`Consultando acciones disponibles para ${orderId}...`);
  const response = await prodigiRequest(
    `/Orders/${encodeURIComponent(orderId)}/actions`
  );
  logJSON("Order actions", response);
};

const runCancelOrder = async (orderIdArg) => {
  const orderId = resolveOrderId(orderIdArg);
  if (!orderId) {
    throw new Error(
      "Debes pasar un orderId como argumento o configurar PRODIGI_TEST_ORDER_ID"
    );
  }

  console.log(`Cancelando orden ${orderId}...`);
  const response = await prodigiRequest(
    `/Orders/${encodeURIComponent(orderId)}/actions/cancel`,
    {
      method: "POST",
      body: {}
    }
  );
  logJSON("Cancel order result", response);
};

if (require.main === module) {
  const [, , command = "product", arg] = process.argv;

  const commands = {
    product: () => runGetProductDetails(arg),
    products: () => runListProducts(),
    quote: () => runGetQuotePreview(arg),
    "orders:list": () => runListOrders(arg),
    "orders:get": () => runGetOrder(arg),
    "orders:actions": () => runGetOrderActions(arg),
    "orders:cancel": () => runCancelOrder(arg),
  };

  if (!commands[command]) {
    console.log("Uso: node server/test-api.js <comando> [argumento]");
    console.log("Comandos disponibles:");
    console.log("  product [SKU]");
    console.log("  products");
    console.log("  quote [SKU]");
    console.log("  orders:list [JSON filtros]");
    console.log("  orders:get <orderId>");
    console.log("  orders:actions <orderId>");
    console.log("  orders:cancel <orderId>");
    process.exit(1);
  }

  commands[command]().catch(handleError);
}

module.exports = {
  runGetProductDetails,
  runListProducts,
  runGetQuotePreview,
  runListOrders,
  runGetOrder,
  runGetOrderActions,
  runCancelOrder,
};
