/**
 * Script inteligente para consultas de quote que detecta automáticamente los atributos requeridos
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { prodigiRequest, PRODIGI_BASE_URL } = require("./utils/prodigiClient");

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

const getProductDetails = async (sku) => {
  console.log(`🔍 Consultando detalles del producto "${sku}"...`);
  try {
    const product = await prodigiRequest(`/products/${encodeURIComponent(sku)}`);
    return product.product;
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ SKU "${sku}" no encontrado en Prodigi`);
    } else {
      console.error(`❌ Error consultando producto: ${error.message}`);
    }
    throw error;
  }
};

const buildQuotePayload = (product, copies = 1) => {
  // Obtener los atributos requeridos del primer variant
  const variant = product.variants?.[0];
  if (!variant) {
    throw new Error("El producto no tiene variantes disponibles");
  }

  const attributes = variant.attributes || {};
  
  console.log(`📋 Atributos detectados:`, attributes);

  return {
    shippingMethod: process.env.PRODIGI_TEST_SHIPPING_METHOD || "Budget",
    destinationCountryCode: process.env.PRODIGI_TEST_COUNTRY || "ES",
    items: [
      {
        sku: product.sku,
        copies: Number(copies),
        attributes,
        assets: [
          {
            printArea: "default",
          },
        ],
      },
    ],
  };
};

const getQuote = async (sku, copies = 1) => {
  try {
    console.log(`🚀 Iniciando consulta de quote para "${sku}" (${copies} copias)\n`);

    // 1. Obtener detalles del producto
    const product = await getProductDetails(sku);
    
    console.log(`✅ Producto encontrado: ${product.description}`);
    console.log(`📏 Dimensiones: ${product.productDimensions?.width}x${product.productDimensions?.height} ${product.productDimensions?.units}`);

    // 2. Construir payload de quote con atributos correctos
    const payload = buildQuotePayload(product, copies);
    
    console.log(`\n📦 Solicitando cotización...`);
    logJSON("Payload de cotización", payload);

    // 3. Solicitar cotización
    const quote = await prodigiRequest("/Quotes", {
      method: "POST",
      body: payload,
    });

    console.log(`\n✅ Cotización obtenida exitosamente`);
    logJSON("Resultado de cotización", quote);

    // 4. Mostrar resumen
    if (quote.quotes && quote.quotes.length > 0) {
      const quoteData = quote.quotes[0];
      const costSummary = quoteData.costSummary;
      
      console.log(`\n💰 RESUMEN DE COTIZACIÓN:`);
      console.log(`=====================================`);
      console.log(`Producto: ${product.description}`);
      console.log(`SKU: ${product.sku}`);
      console.log(`Copias: ${copies}`);
      console.log(`Costo por unidad: ${costSummary.items.amount} ${costSummary.items.currency}`);
      console.log(`Costo total productos: ${(parseFloat(costSummary.items.amount) * copies).toFixed(2)} ${costSummary.items.currency}`);
      console.log(`Costo de envío: ${costSummary.shipping.amount} ${costSummary.shipping.currency}`);
      console.log(`Total sin impuestos: ${costSummary.totalCost.amount} ${costSummary.totalCost.currency}`);
      console.log(`Impuestos: ${costSummary.totalTax.amount} ${costSummary.totalTax.currency}`);
      console.log(`Método de envío: ${quoteData.shipmentMethod}`);
      
      if (quoteData.shipments && quoteData.shipments.length > 0) {
        const shipment = quoteData.shipments[0];
        console.log(`Transportista: ${shipment.carrier.name} - ${shipment.carrier.service}`);
        console.log(`Ubicación: ${shipment.fulfillmentLocation.countryCode} (${shipment.fulfillmentLocation.labCode})`);
      }
      console.log(`=====================================\n`);
    }

    return quote;

  } catch (error) {
    handleError(error);
  }
};

// Función para probar múltiples SKUs
const testMultipleSKUs = async (skus) => {
  console.log(`🧪 Probando múltiples SKUs: ${skus.join(", ")}\n`);
  
  for (const sku of skus) {
    try {
      await getQuote(sku);
      console.log(`\n${'='.repeat(60)}\n`);
    } catch (error) {
      console.error(`❌ Error con SKU ${sku}:`, error.message);
      console.log(`\n${'='.repeat(60)}\n`);
    }
  }
};

// Función principal
if (require.main === module) {
  const [, , command, ...args] = process.argv;

  if (command === "quote" && args.length > 0) {
    const sku = args[0];
    const copies = args[1] ? parseInt(args[1]) : 1;
    getQuote(sku, copies);
  } else if (command === "test" && args.length > 0) {
    // Probar múltiples SKUs: node test-quote-smart.js test SKU1 SKU2 SKU3
    testMultipleSKUs(args);
  } else {
    console.log("Uso:");
    console.log("  node test-quote-smart.js quote <SKU> [copias]");
    console.log("  node test-quote-smart.js test <SKU1> <SKU2> ...");
    console.log("");
    console.log("Ejemplos:");
    console.log("  node test-quote-smart.js quote ART-FAP-SAP-10X15");
    console.log("  node test-quote-smart.js quote GLOBAL-CAN-10x10 2");
    console.log("  node test-quote-smart.js test ART-FAP-SAP-10X15 GLOBAL-CAN-10x10");
    process.exit(1);
  }
}

module.exports = {
  getQuote,
  getProductDetails,
  testMultipleSKUs
};
