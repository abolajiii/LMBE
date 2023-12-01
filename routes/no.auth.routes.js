const noAuthRoute = require("express").Router();
const controller = require("../controller/no.auth.controller");

noAuthRoute.post("/login", controller.signInUser);

noAuthRoute.post("/register", controller.signUpUser);

noAuthRoute.post("/verify-email", controller.verifyEmail);

noAuthRoute.post("/verify-otp", controller.verifyOtp);

noAuthRoute.post("/change-password", controller.changePassword);

module.exports = noAuthRoute;
