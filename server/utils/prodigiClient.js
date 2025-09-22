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

module.exports = {
  isProdigiConfigured,
  ensureProdigiConfigured,
  prodigiRequest,
  PRODIGI_BASE_URL,
};
