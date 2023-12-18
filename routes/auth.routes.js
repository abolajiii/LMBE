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
  const eventData = req.body.data;
  const eventType = req.body.event;

  switch (eventType) {
    case "charge.success":
      console.log("Charge successful:", eventData);
      // Add logic for successful charge handling
      break;

    case "charge.dispute.create":
      console.log("Dispute created:", eventData);
      // Add logic for dispute creation handling
      break;

    case "charge.dispute.remind":
      console.log("Dispute reminder:", eventData);
      // Add logic for dispute reminder handling
      break;

    case "charge.dispute.resolve":
      console.log("Dispute resolved:", eventData);
      // Add logic for dispute resolution handling
      break;

    case "customeridentification.failed":
      console.log("Customer ID validation failed:", eventData);
      // Add logic for customer ID validation failure handling
      break;

    case "customeridentification.success":
      console.log("Customer ID validation successful:", eventData);
      // Add logic for customer ID validation success handling
      break;

    case "dedicatedaccount.assign.failed":
      console.log("DVA assign failed:", eventData);
      // Add logic for DVA assign failure handling
      break;

    case "dedicatedaccount.assign.success":
      console.log("DVA assign success:", eventData);
      // Add logic for DVA assign success handling
      break;

    case "invoice.create":
      console.log("Invoice created:", eventData);
      // Add logic for invoice creation handling
      break;

    case "invoice.payment_failed":
      console.log("Invoice payment failed:", eventData);
      // Add logic for invoice payment failure handling
      break;

    case "invoice.update":
      console.log("Invoice updated:", eventData);
      // Add logic for invoice update handling
      break;

    case "paymentrequest.pending":
      console.log("Payment request pending:", eventData);
      // Add logic for payment request pending handling
      break;

    case "paymentrequest.success":
      console.log("Payment request success:", eventData);
      // Add logic for payment request success handling
      break;

    case "refund.failed":
      console.log("Refund failed:", eventData);
      // Add logic for refund failure handling
      break;

    case "refund.pending":
      console.log("Refund pending:", eventData);
      // Add logic for refund pending handling
      break;

    case "refund.processed":
      console.log("Refund processed:", eventData);
      // Add logic for refund processed handling
      break;

    case "refund.processing":
      console.log("Refund processing:", eventData);
      // Add logic for refund processing handling
      break;

    case "subscription.create":
      console.log("Subscription created:", eventData);
      // Add logic for subscription creation handling
      break;

    case "subscription.disable":
      console.log("Subscription disabled:", eventData);
      // Add logic for subscription disable handling
      break;

    case "subscription.expiring_cards":
      console.log("Subscription expiring cards:", eventData);
      // Add logic for subscription expiring cards handling
      break;

    case "subscription.not_renew":
      console.log("Subscription not renewing:", eventData);
      // Add logic for subscription not renewing handling
      break;

    case "transfer.failed":
      console.log("Transfer failed:", eventData);
      // Add logic for transfer failure handling
      break;

    case "transfer.success":
      console.log("Transfer success:", eventData);
      // Add logic for transfer success handling
      break;

    case "transfer.reversed":
      console.log("Transfer reversed:", eventData);
      // Add logic for transfer reversed handling
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
      // Handle unhandled event types
      break;
  }

  res.status(200).send("Event handled successfully!");
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
  console.log();

  if (verifyPaystackWebhook(payload, signature)) {
    // Signature is valid, process the webhook event
    const event = req.body;
    console.log("Received Paystack webhook event:");

    // Add your logic to update your app based on the webhook event
  } else {
    // Invalid signature, ignore the webhook event
    console.error("Invalid Paystack webhook signature");
  }

  res.status(200).end();
});

module.exports = authRoute;
