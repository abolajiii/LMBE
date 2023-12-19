const authRoute = require("express").Router();
const controller = require("../controller/auth.controller");
const { authMiddleware } = require("../middleware/auth");
const axios = require("axios");
const crypto = require("crypto");
const { User } = require("../model");

const verifyPaystackWebhook = (payload, signature) => {
  const secretKey = "sk_test_41a6539c733c9086a37a78e2cdb17a295c476d62";
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(payload)
    .digest("hex");
  return hash === signature;
};

authRoute.get("/", authMiddleware, async (req, res) => {
  try {
    // Check if there's a valid user
    if (req.user) {
      // Respond with user details
      res.json({
        success: true,
        user: req.user,
      });
    } else {
      // Respond with a message indicating no user
      res.json({
        success: false,
        message: "No user found",
      });
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

authRoute.post("/verify", async (req, res) => {
  const id = req.user.id;

  const user = await User.findOne({
    _id: id,
  });
  const PAYSTACK_SECRET_KEY =
    "sk_test_41a6539c733c9086a37a78e2cdb17a295c476d62";
  try {
    // Assuming you are receiving JSON data with trxRef and reference
    const { reference } = req.body;

    // Fetch transaction details from Paystack to verify payment
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, // Replace with your Paystack secret key
        },
      }
    );

    // Check if the transaction was successful
    if (
      paystackResponse.data.data.status === "success" &&
      paystackResponse.data.data.reference === reference
    ) {
      // Perform additional verification logic if needed
      // Update your database, send email receipts, etc.

      // Respond to the frontend with the verification result
      res.json({
        success: true,
        message: "Payment verification successful",
        user,
      });
    } else {
      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

authRoute.post("/paystack-webhook", (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers["x-paystack-signature"];

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

authRoute.use(authMiddleware);

authRoute.post("/", async (req, res) => {
  const eventData = req.body.data;
  const eventType = req.body.event;

  switch (eventType) {
    case "charge.success":
      // Extract relevant data from the Paystack event
      const userEmail = eventData.customer.email;
      const paymentInterval = eventData.plan.interval;

      // Map Paystack plan intervals to your plan values
      const planMapping = {
        monthly: "monthly",
        annually: "yearly",
        // Add more mappings if needed
      };

      // Determine the subscribed plan based on the Paystack event
      const subscribedPlan = planMapping[paymentInterval] || "free";

      try {
        const user = await User.findOne({ email: userEmail });

        if (user) {
          // Assuming your User model has a field for the user's subscribed plan
          user.plan = subscribedPlan;

          // Save the updated user to the database
          await user.save();

          console.log(`User ${userEmail} plan updated to ${subscribedPlan}`);

          // Send a success response to the frontend
          return res.status(200).json({
            message: "Charge success and user plan updated",
            userEmail,
            subscribedPlan,
          });
        } else {
          console.log(`User with email ${userEmail} not found`);
          return res.status(404).json({
            error: "User not found",
          });
        }
      } catch (error) {
        console.error("Error updating user plan:", error);
        return res.status(500).json({
          error: "Internal Server Error",
        });
      }

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

authRoute.get("/dashboard", controller.getDashboardDetails);

authRoute.get("/jobs", controller.getAllJobs);

authRoute.post("/job/create", controller.createJobForDay);

authRoute.get("/job/:id", controller.viewJob);

authRoute.post(
  "/job/:id/update-all",

  controller.updateAllJobsInTransaction
);

authRoute.get("/job/single/:jobId", controller.viewSingleJob);

authRoute.put("/job/single/:jobId", controller.updateJob);

authRoute.post("/job/upload", controller.uploadJob);

authRoute.delete("/job/single/:jobId", controller.deleteJob);

authRoute.get("/expenses", controller.getAllExpenses);

authRoute.post("/expense/create", controller.createExpense);

authRoute.get("/expense/:id", controller.viewExpense);

authRoute.delete(
  "/expense/:expenseId",

  controller.deleteDailyExpense
);

authRoute.get(
  "/generate/daily",

  controller.generateDailyReport
);

authRoute.get(
  "/generate/weekly",

  controller.generateWeeklyReport
);

authRoute.get(
  "/generate/monthly",

  controller.generateMonthlyReport
);

authRoute.get(
  "/generate/barchart",

  controller.getBarChartDetails
);

authRoute.get("/clients", controller.getClients);

authRoute.get("/allclients", controller.fetchClients);

authRoute.post("/client/create", controller.createClient);

authRoute.put("/update-profile", controller.updateProfile);

authRoute.post("/verify-password", controller.verifyPassword);

authRoute.put("/update-password", controller.updatePassword);

authRoute.post("/valid-token", controller.verifyRefreshToken);

authRoute.get("/download-sample", controller.downloadExcelSample);

authRoute.get("/job/:id/filter", controller.filterJobs);

authRoute.get("/transaction/filter", controller.filterAllJobs);

authRoute.get("/pick-up", controller.getFrequentPickUp);

authRoute.post("/subscribe", controller.handleSubscription);

module.exports = authRoute;
