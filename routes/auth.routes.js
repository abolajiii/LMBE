const authRoute = require("express").Router();
const controller = require("../controller/auth.controller");
const { authMiddleware } = require("../middleware/auth");

const crypto = require("crypto");

const verifyPaystackWebhook = (payload, signature) => {
  const secretKey = "sk_test_41a6539c733c9086a37a78e2cdb17a295c476d62";
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(payload)
    .digest("hex");
  return hash === signature;
};

authRoute.get("/", async (req, res) => {
  res.status(200).send("Hello Pay stack!");
});

authRoute.post("/", async (req, res) => {
  res.status(200).send("Waiting for stack!");
});

authRoute.get("/dashboard", authMiddleware, controller.getDashboardDetails);

authRoute.get("/jobs", authMiddleware, controller.getAllJobs);

authRoute.post("/job/create", authMiddleware, controller.createJobForDay);

authRoute.get("/job/:id", authMiddleware, controller.viewJob);

authRoute.post(
  "/job/:id/update-all",
  authMiddleware,
  controller.updateAllJobsInTransaction
);

authRoute.get("/job/single/:jobId", authMiddleware, controller.viewSingleJob);

authRoute.put("/job/single/:jobId", authMiddleware, controller.updateJob);

authRoute.post("/job/upload", authMiddleware, controller.uploadJob);

authRoute.delete("/job/single/:jobId", authMiddleware, controller.deleteJob);

authRoute.get("/expenses", authMiddleware, controller.getAllExpenses);

authRoute.post("/expense/create", authMiddleware, controller.createExpense);

authRoute.get("/expense/:id", authMiddleware, controller.viewExpense);

authRoute.delete(
  "/expense/:expenseId",
  authMiddleware,
  controller.deleteDailyExpense
);

authRoute.get(
  "/generate/daily",
  authMiddleware,
  controller.generateDailyReport
);

authRoute.get(
  "/generate/weekly",
  authMiddleware,
  controller.generateWeeklyReport
);

authRoute.get(
  "/generate/monthly",
  authMiddleware,
  controller.generateMonthlyReport
);

authRoute.get(
  "/generate/barchart",
  authMiddleware,
  controller.getBarChartDetails
);

authRoute.get("/clients", authMiddleware, controller.getClients);

authRoute.get("/allclients", authMiddleware, controller.fetchClients);

authRoute.post("/client/create", authMiddleware, controller.createClient);

authRoute.put("/update-profile", authMiddleware, controller.updateProfile);

authRoute.post("/verify-password", authMiddleware, controller.verifyPassword);

authRoute.put("/update-password", authMiddleware, controller.updatePassword);

authRoute.post("/valid-token", authMiddleware, controller.verifyRefreshToken);

authRoute.get("/download-sample", controller.downloadExcelSample);

authRoute.get("/job/:id/filter", authMiddleware, controller.filterJobs);

authRoute.get("/transaction/filter", authMiddleware, controller.filterAllJobs);

authRoute.get("/pick-up", authMiddleware, controller.getFrequentPickUp);

authRoute.post("/subscribe", authMiddleware, controller.handleSubscription);

authRoute.post("/paystack-webhook", (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers["x-paystack-signature"];

  if (verifyPaystackWebhook(payload, signature)) {
    // Signature is valid, process the webhook event
    const event = req.body;
    console.log("Received Paystack webhook event:", event);

    // Add your logic to update your app based on the webhook event
  } else {
    // Invalid signature, ignore the webhook event
    console.error("Invalid Paystack webhook signature");
  }

  res.status(200).end();
});

module.exports = authRoute;
