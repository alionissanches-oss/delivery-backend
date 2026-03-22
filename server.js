const express = require("express");
const cors = require("cors");
const { optimizeRoute } = require("./routeOptimizer");

const app = express();

app.use(cors());
app.use(express.json());

// Ruta base para verificar conexión
app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente");
});

app.post("/optimize", async (req, res) => {
  try {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length < 2) {
      return res.status(400).json({
        error: "Debes enviar al menos 2 direcciones.",
      });
    }

    const result = await optimizeRoute(addresses);
    return res.json(result);
  } catch (error) {
    console.log("Optimize API error:", error);
    return res.status(500).json({
      error: "No se pudo optimizar la ruta.",
    });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Servidor corriendo en http://0.0.0.0:3000");
});