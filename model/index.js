const mongoose = require("mongoose");

// Define the User model
const userSchema = new mongoose.Schema(
  {
    username: String,
    email: { type: String, unique: true },
    password: String,
    state: String,
    businessName: String,
    businessType: String,
    location: String,
    phoneNumber: String,
    lastActive: Date,
    workingDays: Number,
    multipleCount: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
    subscribedPlan: {
      type: String,
      enum: ["trial", "free", "monthly", "yearly"],
      default: "trial",
    },
    trialEnd: { type: Date, default: Date.now() + 30 * 24 * 60 * 60 * 1000 }, // 30 days trial

    role: [String], // You can define specific roles like "admin" or "user"
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Define the Job model
const jobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Replace with the actual model name for users
      required: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    customerName: String,
    pickUp: String,
    delivery: String,
    amount: Number,
    payer: {
      type: String,
      enum: ["pick-up", "vendor", "delivery"],
    },
    jobStatus: {
      type: String,
      enum: ["pending", "done", "canceled", "next-day"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["not-paid", "void", "paid"],
      default: "not-paid",
    },
  },
  { timestamps: true }
);

const Job = mongoose.model("Job", jobSchema);

// Define the Transaction model

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    totalJobAmount: {
      type: Number,
      required: true,
    },
    numberOfPaidJobs: {
      type: Number,
      required: true,
    },
    numberOfJobs: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "not-paid", "not-fully-paid", "void"],
      default: "not-paid",
      required: true,
    },
    totalAmountPaid: {
      type: Number,
      required: true,
    },
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ],
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

// Expense

const expenseSchema = new mongoose.Schema(
  {
    totalAmount: Number,
    numberOfExpenses: Number,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expenses: [
      {
        expense: String,
        amount: Number,
      },
    ],
    date: {
      type: Date,
      default: Date.now,
      index: true, // Add an index for faster queries on date
    },
  },
  { timestamps: true }
);

const DailyExpense = mongoose.model("DailyExpense", expenseSchema);

const clientSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    phone: Number,
    email: String,
    totalJobs: Number, // Total number of jobs from the client
    lastJobDate: Date, // Date when the client last gave you a job
    totalJobAmount: Number, // Total amount of the job when the client last gave you a job
  },
  { timestamps: true }
);

const Client = mongoose.model("Client", clientSchema);

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

const OTP = mongoose.model("OTP", otpSchema);

module.exports = {
  User,
  Job,
  Transaction,
  DailyExpense,
  Client,
  RefreshToken,
  OTP,
};
