import express from "express";

const router = express.Router();

// Legacy SAP route placeholder
// Add legacy SAP API handlers here if needed.
router.get("/", (req, res) => {
  res.json({ message: "Legacy SAP API root" });
});

export default router;
