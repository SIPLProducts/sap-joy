require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const https = require("https");

const app = express();

// Reusable HTTPS agent for SAP endpoints with self-signed certificates
const sapAgent = new https.Agent({ rejectUnauthorized: false });

// Load legacy SAP routes if they exist
let sapRoutes;
try {
  sapRoutes = require("./routes/sapRoutes");
} catch (e) {
  sapRoutes = null;
}

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Request Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Generic SAP proxy endpoint used by the frontend and edge functions
app.post("/proxy", async (req, res) => {
  try {
    const { url, method, body, auth } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Missing URL in request body" });
    }

    const sapHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (auth && auth.username && auth.password) {
      const token = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      sapHeaders.Authorization = `Basic ${token}`;
    }

    const sapRes = await axios({
      method: method || "GET",
      url,
      headers: sapHeaders,
      data: body,
      timeout: 30000,
      validateStatus: () => true,
      httpsAgent: sapAgent,
    });

    res.status(sapRes.status).json(sapRes.data);
  } catch (err) {
    console.error("SAP Proxy Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Legacy SAP routes (kept for backward compatibility)
if (sapRoutes) {
  app.use("/sap/api", sapRoutes);
  app.use("/api/sap", sapRoutes);
}

// Root route
app.get("/", (req, res) => {
  res.send("SAP Proxy Running");
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
