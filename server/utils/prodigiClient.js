const { URL } = require("url");

let fetchFn = global.fetch;
if (typeof fetchFn !== "function") {
  fetchFn = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

const PRODIGI_API_KEY = process.env.PRODIGI_API_KEY ;
console.log("PRODIGI_API_KEY", PRODIGI_API_KEY);
const PRODIGI_BASE_URL =
  process.env.PRODIGI_BASE_URL?.replace(/\/?$/, "") ||
  "https://api.sandbox.prodigi.com/v4.0";

const isProdigiConfigured = Boolean(PRODIGI_API_KEY);

const ensureProdigiConfigured = () => {
  if (!isProdigiConfigured) {
    throw new Error("Prodigi API key is not configured");
  }
};

const assetCache = new Map();

const buildUrl = (path) => {
  const sanitizedBase = PRODIGI_BASE_URL.replace(/\/$/, "");
  const cleanedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(cleanedPath, `${sanitizedBase}/`).toString();
};

const prodigiRequest = async (path, { method = "GET", headers = {}, body } = {}) => {
  ensureProdigiConfigured();

  const requestHeaders = {
    "X-API-Key": PRODIGI_API_KEY,
    Accept: "application/json",
    ...headers,
  };

  let requestBody = body;
  if (body && typeof body !== "string") {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetchFn(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(
      `Prodigi request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

const uploadProdigiAsset = async (assetUrl) => {
  ensureProdigiConfigured();

  if (!assetUrl || !/^https?:\/\//i.test(assetUrl)) {
    return null;
  }

  if (assetCache.has(assetUrl)) {
    const cachedResult = assetCache.get(assetUrl);
    console.log("[Prodigi] Using cached asset:", { assetUrl, cachedResult });
    return cachedResult;
  }

  const payload = {
    items: [
      {
        assets: [
          {
            type: "PrintFile",
            source: {
              url: assetUrl,
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await prodigiRequest("/Assets", {
      method: "POST",
      body: payload,
    });

    const assetId =
      response?.items?.[0]?.assets?.[0]?.id || response?.assets?.[0]?.id || null;

    if (!assetId) {
      console.warn("[Prodigi] Asset upload did not return an id", response);
      assetCache.set(assetUrl, null);
      return null;
    }

    const cacheEntry = { assetId };
    assetCache.set(assetUrl, cacheEntry);
    console.log("[Prodigi] Asset upload successful:", { assetUrl, assetId });
    return cacheEntry;
  } catch (error) {
    console.warn("[Prodigi] Failed to upload asset", { assetUrl, error: error.message });
    assetCache.set(assetUrl, null);
    return null;
  }
};

module.exports = {
  isProdigiConfigured,
  ensureProdigiConfigured,
  prodigiRequest,
  PRODIGI_BASE_URL,
  uploadProdigiAsset,
};
