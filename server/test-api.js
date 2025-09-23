const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { prodigiRequest, PRODIGI_BASE_URL } = require("./utils/prodigiClient");

const resolveSku = () => process.argv[2] || process.env.PRODIGI_TEST_SKU || "GLOBAL-CAN-10x10";

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

const runGetProductDetails = async () => {
  const sku = resolveSku();
  console.log(`Consultando detalles de producto para SKU "${sku}"...`);
  const product = await prodigiRequest(`/products/${encodeURIComponent(sku)}`);
  logJSON("Product details", product);
};

const runListProducts = async () => {
  console.log("Listando productos disponibles...");
  const products = await prodigiRequest("/products");
  logJSON("Products", products);
};

const runGetQuotePreview = async () => {
  const sku = resolveSku();
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
        sizing: process.env.PRODIGI_TEST_SIZING || "fillPrintArea",
        assets: [
          {
            printArea: "default",
            url: assetUrl,
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

if (require.main === module) {
  runGetProductDetails().catch(handleError);
  // runListProducts().catch(handleError);
  // runGetQuotePreview().catch(handleError);
}

module.exports = {
  runGetProductDetails,
  runListProducts,
  runGetQuotePreview,
};
