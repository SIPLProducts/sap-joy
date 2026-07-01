const express = require("express");
const router = express.Router();

// Legacy SAP route placeholder
// Add legacy SAP API handlers here if needed.
router.get("/", (req, res) => {
  res.json({ message: "Legacy SAP API root" });
});

module.exports = router;
