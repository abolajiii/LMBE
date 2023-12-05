const authRoute = require("express").Router();
const controller = require("../controller/auth.controller");
const { authMiddleware } = require("../middleware/auth");

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

module.exports = authRoute;
