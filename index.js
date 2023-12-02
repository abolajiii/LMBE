require("dotenv").config();

const {
  User,
  DailyExpense,
  Transaction,
  Client,
  RefreshToken,
  Job,
} = require("./model");

const authRoute = require("./routes/auth.routes");
const noAuthRoute = require("./routes/no.auth.routes");

const cron = require("node-cron");
const fileUpload = require("express-fileupload");
const XLSX = require("xlsx");
const ejs = require("ejs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { createJobsAndExpenses } = require("./controller/auth.controller");

const PORT = 7500;

const app = express();

app.use(cors());
app.use(fileUpload());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.uri)
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((err) => {
    console.log(err);
  });

app.use("/api/v1/", authRoute);
app.use("/api/v1/", noAuthRoute);

const newDnd = async () => {
  // const user = await User.find({});
  // console.log(user);
  // await DailyExpense.deleteMany({
  // user: "65683bd4312811ff3337556d",
  // });
  await DailyExpense.deleteMany({ user: "6569c1c0e61f2a962f1b31e4" });
  await Job.deleteMany({ user: "6569c1c0e61f2a962f1b31e4" });
  await Client.deleteMany({
    user: "6569c1c0e61f2a962f1b31e4",
  });
  await Transaction.deleteMany({ user: "6569c1c0e61f2a962f1b31e4" });
  await RefreshToken.deleteMany({ user: "6569c1c0e61f2a962f1b31e4" });
  //   const data = {
  //     username: "dev",
  //     email: "dev@dev.com",
  //     password: "Admin12345!",
  //     businessName: "aquad-errands",
  //   };˜
  //   const response = await registerUser(data);
  //   console.log(response);
  // await createJobsAndExpenses();
};

// newDnd();

// getWeeklyReport();
// createJobsAndExpenses();

app.listen(PORT, console.log(`PORT ${PORT}`));
