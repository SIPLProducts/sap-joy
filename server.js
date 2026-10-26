import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import https from "https";

const app = express();

// Reusable HTTPS agent for SAP endpoints with self-signed certificates
const sapAgent = new https.Agent({ rejectUnauthorized: false });

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
    const { url, method, body, auth, timeout } = req.body;

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
      // 0 = no limit (wait until SAP finishes); caller may pass a custom timeout in ms
      timeout: Number(timeout) > 0 ? Number(timeout) : 0,
      validateStatus: () => true,
      httpsAgent: sapAgent,
    });

    res.status(sapRes.status).json(sapRes.data);
  } catch (err) {
    console.error("SAP Proxy Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Legacy SAP routes (optional, kept for backward compatibility)
try {
  const { default: sapRoutes } = await import("./routes/sapRoutes.js");
  app.use("/sap/api", sapRoutes);
  app.use("/api/sap", sapRoutes);
} catch (e) {
  // routes/sapRoutes.js not present — continue without legacy routes
}

// Root route
app.get("/", (req, res) => {
  res.send("SAP Proxy Running");
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
