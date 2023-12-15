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
const adminAuthRoute = require("./routes/admin.routes");
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
app.use("/api/v1/admin/", adminAuthRoute);

const newDnd = async () => {
  const user = await User.find({
    user: "65683bd4312811ff3337556d",
  });
  // console.log(user);
  // await DailyExpense.deleteMany({
  // user: "65683bd4312811ff3337556d",
  // });
  await DailyExpense.deleteMany({ user: "65683bd4312811ff3337556d" });
  await Job.deleteMany({ user: "65683bd4312811ff3337556d" });
  await Client.deleteMany({
    user: "65683bd4312811ff3337556d",
  });
  await Transaction.deleteMany({ user: "65683bd4312811ff3337556d" });
  await RefreshToken.deleteMany({ user: "65683bd4312811ff3337556d" });
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

// updateUsersLastActive();

const setAdminToUser = async () => {
  try {
    // Find all users
    const users = await User.find({});
    // await User.findByIdAndDelete("657ba2b3b421ed75304bca30");

    // Loop through users
    for (const user of users) {
      // Check if the username is "admin"
      if (!user.multipleCount) {
        // Set role to "admin" for the user with username "admin"
        user.multipleCount = 0;
      }

      // Save the updated user
      await user.save();
    }
    // console.log(users);

    console.log("Roles updated successfully");
  } catch (error) {
    console.error("Error updating roles:", error);
  }
};

// Call the function
// setAdminToUser();

// newDnd();

// getWeeklyReport();
// createJobsAndExpenses();

app.listen(PORT, console.log(`PORT ${PORT}`));
