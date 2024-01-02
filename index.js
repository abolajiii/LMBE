require("dotenv").config();
const casual = require("casual");
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
  const user = await User.findOne({
    username: "mike",
  });

  await DailyExpense.deleteMany({ user: user._id });
  await Job.deleteMany({ user: user._id });
  await Client.deleteMany({
    user: user._id,
  });
  await Transaction.deleteMany({ user: user._id });
  await RefreshToken.deleteMany({ user: user._id });

  console.log("done");
};



const generateMockData = async () => {
  const user = await User.findOne({ username: "kim" });
  const userId = user._id; // Replace with the actual user ID
  const startDate = new Date("2023-12-01");
  const endDate = new Date(); // Today's date

  // Generate a constant set of 20 clients
  const clients = [];
  for (let j = 0; j < 10; j++) {
    const clientName = casual.first_name;
    clients.push(clientName);
  }

  for (let i = new Date(startDate); i <= endDate; i.setDate(i.getDate() + 1)) {
    const date = i.toISOString();

    // Check if a transaction already exists for the day
    let transaction = await Transaction.findOne({
      user: userId,
      createdAt: {
        $gte: date,
        $lt: new Date(i.getTime() + 86400000).toISOString(), // Adding 86400000 milliseconds (24 hours) to get the next day
      },
    });

    if (!transaction) {
      // If no transaction, create a new one
      transaction = new Transaction({
        user: userId,
        totalJobAmount: 0,
        numberOfPaidJobs: 0,
        numberOfJobs: 0,
        paymentStatus: "not-paid",
        totalAmountPaid: 0,
        jobs: [],
        createdAt: date,
      });
      await transaction.save();
    }

    //   // Generate jobs for each client
    for (const clientName of clients) {
      // Check if the client already exists
      let client = await Client.findOne({ user: userId, name: clientName });

      if (!client) {
        // If no client, create a new one
        client = new Client({
          user: userId,
          name: clientName,
          totalJobs: 0,
          lastJobDate: null,
          totalJobAmount: 0,
        });
        await client.save();
      }

      //     // Generate at least 8 jobs for each client
      const jobCount = Math.max(3, Math.floor(Math.random() * 4));
      for (let k = 0; k < jobCount; k++) {
        const jobDetails = {
          transaction: transaction._id,
          customerName: clientName,
          pickUp: casual.city,
          amount: casual.integer((from = 1000), (to = 5000)),
          payer: casual.random_element(["pick-up", "delivery", "vendor"]),
          jobStatus: "pending",
          paymentStatus: "not-paid",
          createdAt: date,
          delivery: casual.city,
          user: userId,
        };

        const job = new Job(jobDetails);
        await job.save();

        transaction.jobs.push(job._id);
        transaction.totalJobAmount += jobDetails.amount;
        transaction.numberOfJobs++;
        transaction.paymentStatus = "not-paid";
        client.totalJobAmount += jobDetails.amount;

        await transaction.save();

        console.log(
          `Day -${date}, JobCount - ${jobCount}, Client -${clientName}, Pick up -${jobDetails.pickUp}`
        );

        await transaction.save();

        // Update client details outside the loop
      }

      const currentDate = new Date(date);
      const lastJobDate =
        client.lastJobDate !== null ? new Date(client.lastJobDate) : null;
      client.totalJobs += jobCount;
      client.lastJobDate =
        lastJobDate !== null && currentDate < lastJobDate
          ? lastJobDate
          : currentDate;
      await client.save();
    }
  }
};

// Call the function to generate mock data
// generateMockData()
//   .then(() => {
//     console.log("Mock data created successfully");
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("Error creating mock data:", error);
//     process.exit(1);
//   });




app.listen(PORT, console.log(`PORT ${PORT}`));
