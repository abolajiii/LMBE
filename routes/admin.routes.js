const adminAuthRoute = require("express").Router();
const controller = require("../controller/admin.controller");
const { checkUserAndVerifyAdmin } = require("../middleware/auth.admin");

adminAuthRoute.get("/users", checkUserAndVerifyAdmin, controller.getAllUsers);

module.exports = adminAuthRoute;
