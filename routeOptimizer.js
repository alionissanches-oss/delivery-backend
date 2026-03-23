const { GoogleAuth } = require("google-auth-library");

const fetchFn = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const GOOGLE_API_KEY = "AIzaSyDBmOC5dK1kjjj6AGdFiHdgZHg-CaYXA-8";
const PROJECT_ID = "delivery-app-490923";

const auth = new GoogleAuth({
  keyFile: "./service-account.json",
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function geocodeAddress(address) {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({
      address,
      key: GOOGLE_API_KEY,
    }).toString();

  const response = await fetchFn(url);
  const data = await response.json();

  console.log("GEOCODING RESPONSE:", {
    address,
    httpStatus: response.status,
    status: data?.status,
    error_message: data?.error_message,
    firstResult: data?.results?.[0]?.formatted_address,
  });

  if (!response.ok) {
    throw new Error(
      data?.error_message ||
        `HTTP ${response.status} al consultar Geocoding API.`
    );
  }

  if (
    data.status !== "OK" ||
    !Array.isArray(data.results) ||
    !data.results[0]
  ) {
    throw new Error(
      `Geocoding falló para "${address}" | status=${data?.status || "sin_status"} | error=${data?.error_message || "sin_error_message"}`
    );
  }

  const location = data.results[0].geometry?.location;

  if (
    !location ||
    typeof location.lat !== "number" ||
    typeof location.lng !== "number"
  ) {
    throw new Error(`Geocoding inválido para la dirección: ${address}`);
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
  };
}

async function optimizeRoute(startAddress, addresses) {
  if (typeof startAddress !== "string" || !startAddress.trim()) {
    throw new Error("Debes enviar un punto de partida válido.");
  }

  if (!Array.isArray(addresses) || addresses.length < 2) {
    throw new Error("Debes enviar al menos 2 direcciones.");
  }

  const cleanStartAddress = startAddress.trim();
  const cleanAddresses = addresses
    .filter((address) => typeof address === "string")
    .map((address) => address.trim())
    .filter((address) => address.length > 0);

  if (cleanAddresses.length < 2) {
    throw new Error("Debes enviar al menos 2 direcciones válidas.");
  }

  const startLocation = await geocodeAddress(cleanStartAddress);
  const locations = await Promise.all(cleanAddresses.map(geocodeAddress));

  const shipments = locations.map((latLng, index) => ({
    deliveries: [
      {
        arrivalLocation: latLng,
        label: cleanAddresses[index],
      },
    ],
  }));

  const body = {
    model: {
      shipments,
      vehicles: [
        {
          startLocation,
          endLocation: startLocation,
          label: "vehiculo-1",
        },
      ],
    },
  };

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token =
    typeof accessToken === "string" ? accessToken : accessToken?.token;

  if (!token) {
    throw new Error("No se pudo obtener el token de acceso.");
  }

  const response = await fetchFn(
    `https://routeoptimization.googleapis.com/v1/projects/${PROJECT_ID}:optimizeTours`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        "Google Route Optimization devolvió un error."
    );
  }

  return data;
}

module.exports = { optimizeRoute };