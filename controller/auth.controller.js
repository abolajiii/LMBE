const { Client, Job, Transaction, DailyExpense, User } = require("../model");
const moment = require("moment");
const XLSX = require("xlsx");
const { paginateResults, paginateExpense } = require("../utils");
const bcrypt = require("bcrypt");

const handleJob = async (data, userId, client) => {
  try {
    return await handleSingleOrMultipleJob(data, userId, client);
  } catch (error) {
    console.log(error);
  }
};

const handleSingleOrMultipleJob = async (data, userId, client) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    let transaction = await Transaction.findOne({
      user: userId,
      createdAt: { $gte: today },
    });

    if (!transaction) {
      transaction = new Transaction({
        user: userId,
        totalJobAmount: 0,
        numberOfPaidJobs: 0,
        numberOfJobs: 0,
        paymentStatus: "not-paid",
        totalAmountPaid: 0,
        jobs: [],
      });
    }

    const jobDetails = {
      transaction: transaction._id,
      customerName: data.customerName,
      pickUp: data.pickUp,
      amount: 0,
      payer: "",
      jobStatus: "pending",
      paymentStatus: "not-paid",
    };

    for (const delivery of data.delivery) {
      jobDetails.delivery = delivery.location;
      jobDetails.amount = Number(delivery.amount);
      jobDetails.payer = delivery.payer;

      const job = new Job(jobDetails);
      await job.save();

      transaction.jobs.push(job._id);
      transaction.totalJobAmount += jobDetails.amount;
      transaction.numberOfJobs++;
      transaction.paymentStatus = "not-paid";
    }

    await transaction.save();

    // Update client details outside the loop
    client.totalJobs += data.delivery.length;
    client.lastJobDate = new Date();
    client.totalJobAmount += jobDetails.amount;
    await client.save();

    return transaction;
  } catch (error) {
    console.log(error);
  }
};

const createJob = async (req, res) => {
  const userId = req.user._id;
  const data = req.body.data;
  const { customerName } = data;

  try {
    let client = await Client.findOne({ user: userId, name: customerName });

    if (!client) {
      client = new Client({
        user: userId,
        name: customerName,
        totalJobs: 0,
        lastJobDate: null,
        totalJobAmount: 0,
      });
      await client.save();
    }

    const job = await handleJob(data, userId, client);
    res.status(201).json({ message: "Job created successfully.", id: job._id });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllJobs = async (req, res) => {
  const userId = req.user._id;

  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    const result = await paginateResults(
      { user: userId },
      Transaction,
      "jobs",
      page,
      limit
    );

    res.status(200).json({ jobs: result.results, pagination: result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

const viewJob = async (req, res) => {
  const id = req.params.id;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  try {
    // Find the transaction by ID and populate the jobs
    const transaction = await Transaction.findById(id).populate("jobs");

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Paginate the jobs within the transaction
    const result = await paginateResults(
      { _id: { $in: transaction.jobs } },
      Job,
      "_id",
      page,
      limit
    );

    // Send the response with the populated data and pagination information
    return res
      .status(200)
      .json({ job: transaction, jobs: result.results, pagination: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const viewSingleJob = async (req, res) => {
  const jobId = req.params.jobId;

  try {
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ job });
  } catch (error) {
    console.log(error);
  }
};

const updateJob = async (req, res) => {
  const jobId = req.params.jobId;
  const data = req.body.data;
  const userId = req.user._id;

  try {
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Store the previous payment status
    const previousPaymentStatus = job.paymentStatus;

    // Fetch the specific date of the job
    const specificDate = job.createdAt.toISOString().split("T")[0];

    // Find the associated transaction for the specific date
    let transaction = await Transaction.findOne({
      user: userId,
      createdAt: { $gte: specificDate },
    });

    if (transaction && data.paymentStatus) {
      // Check if the previous payment status was not "paid" and the new data is "paid"
      if (previousPaymentStatus !== "paid" && data.paymentStatus === "paid") {
        // Increase the totalAmountPaid and numberOfPaidJobs
        transaction.totalAmountPaid += job.amount;
        transaction.numberOfPaidJobs += 1;
      }

      // Check if the previous payment status was "paid" and the new data is not "paid"
      if (previousPaymentStatus === "paid" && data.paymentStatus !== "paid") {
        // Decrease the totalAmountPaid and numberOfPaidJobs
        transaction.totalAmountPaid -= job.amount;
        transaction.numberOfPaidJobs -= 1;
      }

      // Update paymentStatus based on the numberOfPaidJobs
      transaction.paymentStatus =
        transaction.numberOfPaidJobs === transaction.numberOfJobs
          ? "paid"
          : "not-paid";

      // Save the updated transaction
      await transaction.save();
    }

    // Update the job with the new data
    job.set(data);
    await job.save();

    // Return the updated job
    res.json(job);
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ error: "An error occurred while updating the job" });
  }
};

const deleteJob = async (req, res) => {
  const jobId = req.params.jobId;

  try {
    // Find the job by ID and delete it
    const deletedJob = await Job.findOneAndDelete({ _id: jobId });

    if (!deletedJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Find the associated transaction for the job
    const transaction = await Transaction.findOne({
      jobs: deletedJob._id, // Assuming the transaction field in Job model is the reference to Transaction
    });

    if (transaction) {
      // Update the transaction details
      transaction.numberOfJobs -= 1;
      transaction.totalAmountPaid -= Number(deletedJob.amount);
      transaction.totalJobAmount -= Number(deletedJob.amount);

      // Check if the deleted job is paid
      if (deletedJob.paymentStatus === "paid") {
        transaction.numberOfPaidJobs -= 1;
      }

      // Update paymentStatus based on the numberOfPaidJobs

      if (transaction.numberOfJobs !== 0) {
        transaction.paymentStatus =
          transaction.numberOfPaidJobs === transaction.numberOfJobs
            ? "paid"
            : "not-paid";
      } else {
        transaction.paymentStatus = "void";
      }

      // Save the updated transaction
      await transaction.save();
    }

    res.json({ message: "Job deleted successfully", deletedJob });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "An error occurred while deleting the job" });
  }
};

const uploadJob = async (req, res) => {
  const userId = req.user._id;

  try {
    const jobData = req.body;

    const { customerName, pickUp } = jobData;

    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.files.file;

    if (
      file.mimetype !==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return res.status(400).json({ error: "Invalid file format" });
    }

    // Process the Excel file (assuming it contains job data)
    const workbook = XLSX.read(file.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    // Check if the required columns are present and not empty in a case-insensitive manner
    if (
      !data.every(
        (row) =>
          (row.Delivery || row.delivery) &&
          (row.Amount || row.amount) &&
          (row.Payer || row.payer)
      )
    ) {
      return res.status(400).json({
        error:
          "Excel file must contain 'Delivery', 'Amount', and 'Payer' columns with non-empty values.",
      });
    }

    // Find or create the client based on the user and client name
    let client = await Client.findOne({ user: userId, name: customerName });

    if (!client) {
      client = new Client({
        user: userId,
        name: customerName,
        totalJobs: 0,
        lastJobDate: null,
        totalJobAmount: 0,
      });
      await client.save();
    }

    // Check if there is a transaction for the day
    const today = new Date().toISOString().split("T")[0];
    let transaction = await Transaction.findOne({
      user: userId,
      createdAt: { $gte: today },
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
      });
    }

    // Handle the job details
    for (const row of data) {
      // Update job details for each row
      const jobDetails = {
        transaction: transaction._id,
        customerName,
        pickUp,
        delivery: row.Delivery || row.delivery,
        amount: Number(row.Amount || row.amount) || 0,
        payer: row.Payer || row.payer,
        jobStatus: "pending",
        paymentStatus: "not-paid",
      };

      // Save the job details to the database
      const job = new Job(jobDetails);
      await job.save();

      // Update the transaction properties
      transaction.jobs.push(job._id);
      transaction.totalJobAmount += jobDetails.amount;
      transaction.numberOfJobs++;
      transaction.paymentStatus = "not-paid";
      await transaction.save();
    }

    // Update client details
    client.totalJobs += data.length; // Increment totalJobs by the number of deliveries
    client.lastJobDate = new Date();
    client.totalJobAmount += jobDetails.amount; // Update totalJobAmount based on the transaction
    await client.save();

    res
      .status(200)
      .json({ message: "Jobs uploaded successfully", id: transaction._id });
  } catch (error) {
    console.log(error);
  }
};

const getAllExpenses = async (req, res) => {
  const userId = req.user._id;

  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    const result = await paginateResults(
      { user: userId },
      DailyExpense,
      "_id",
      page,
      limit
    );

    res.status(200).json({ expenses: result.results, pagination: result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

const createExpense = async (req, res) => {
  const userId = req.user._id;

  try {
    const expenses = req.body.data;
    const today = new Date().toISOString().split("T")[0];

    const dailyExpense = await DailyExpense.findOne({
      user: userId,
      createdAt: { $gte: today },
    });

    if (dailyExpense) {
      // If DailyExpense for today exists, update the properties and push the new expenses
      dailyExpense.totalAmount += expenses.reduce(
        (total, exp) => total + Number(exp.amount),
        0
      );
      dailyExpense.numberOfExpenses += expenses.length;
      dailyExpense.expenses.push(...expenses);
      await dailyExpense.save();

      res.status(200).json({
        message: "Expenses created successfully",
        id: dailyExpense._id,
      });
    } else {
      // If DailyExpense for today doesn't exist, create a new one
      const totalAmount = expenses.reduce(
        (total, exp) => total + Number(exp.amount),
        0
      );
      const numberOfExpenses = expenses.length;

      const newDailyExpense = await DailyExpense.create({
        user: userId,
        expenses: expenses,
        totalAmount: totalAmount,
        numberOfExpenses: numberOfExpenses,
        date: today,
      });

      res.status(200).json({
        message: "Expenses created successfully",
        id: newDailyExpense._id,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

const viewExpense = async (req, res) => {
  const id = req.params.id;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  try {
    // Find the transaction by ID and populate the jobs
    const expense = await DailyExpense.findById(id);

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    // Use the paginateResults function
    const result = await paginateExpense(expense, page, limit);

    return res
      .status(200)
      .json({ expense, pagination: result, expenses: result.results });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const calculateMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.params;

    // Fetch transactions for the specified month and year
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    let transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lt: endDate },
      user: userId,
    });

    // Calculate total jobs and total job amount
    let totalJobs = 0;
    let totalJobAmount = 0;
    let highestAmount = 0;
    let lowestAmount = Infinity;
    let daysWithoutJob = new Date(year, month + 1, 0).getDate(); // Initialize with total days in the month

    const jobDates = transactions.map(
      (transaction) => transaction.createdAt.toISOString().split("T")[0]
    );

    transactions.forEach((transaction) => {
      totalJobs += transaction.numberOfJobs;
      totalJobAmount += transaction.totalJobAmount;

      // Update highest and lowest amounts
      if (transaction.totalJobAmount > highestAmount) {
        highestAmount = transaction.totalJobAmount;
      }
      if (transaction.totalJobAmount < lowestAmount) {
        lowestAmount = transaction.totalJobAmount;
      }

      // Check if there's a job on the current day and reduce daysWithoutJob if there is
      const currentDate = transaction.createdAt.toISOString().split("T")[0];
      if (jobDates.includes(currentDate)) {
        daysWithoutJob--;
      }
    });

    // Fetch total expenses for the specified month and year
    const expenses = await DailyExpense.find({
      date: { $gte: startDate, $lt: endDate },
    });

    // Calculate total expenses
    let totalExpenses = 0;
    expenses.forEach((expense) => {
      totalExpenses += expense.totalAmount;
    });

    // Prepare the report object
    const report = {
      month: parseInt(month),
      year: parseInt(year),
      totalJobs,
      totalJobAmount,
      totalExpenses,
      daysWithoutJob,
      highestAmount,
      lowestAmount,
    };

    // console.log(report);

    res.status(200).json({ report });
  } catch (error) {
    console.error(error);
    // res.status(500).json({ error: "Internal Server Error" });
  }
};

const getData = async (userId) => {
  const today = new Date().toISOString().split("T")[0];

  const todayExpenses = await DailyExpense.find({
    user: userId,
    createdAt: { $gte: today },
  });

  const todayTransactions = await Transaction.find({
    user: userId,
    createdAt: { $gte: today },
  });

  if (todayTransactions.length === 0) {
    const yesterdayData = await getYesterdayData(userId, today);
    return {
      yesterdayData,
      todayData: {
        returns: 0,
        expenses: 0,
        numberOfJobs: 0,
      },
    };
  }

  const yesterdayData = await getYesterdayData(userId, today);

  const todayData = {
    date:
      todayTransactions.length > 0
        ? todayTransactions[0].createdAt.toISOString().split("T")[0]
        : null,
    returns: todayTransactions.reduce(
      (total, transaction) => total + transaction.totalAmountPaid,
      0
    ),
    expenses: todayExpenses.reduce(
      (total, expense) => total + expense.totalAmount,
      0
    ),
    numberOfJobs: todayTransactions.reduce(
      (totalJobs, transaction) => totalJobs + transaction.numberOfJobs,
      0
    ),
  };

  return { yesterdayData, todayData };
};

const getYesterdayData = async (userId, today) => {
  const lastTransaction = await Transaction.findOne({
    user: userId,
    createdAt: { $lt: today },
  }).sort({ createdAt: -1 });

  if (!lastTransaction) {
    return {};
  }

  const yesterdayExpenses = await DailyExpense.find({
    user: userId,
    createdAt: {
      $gte: lastTransaction.createdAt.toISOString().split("T")[0],
      $lt: today,
    },
  });

  const yesterdayData = {
    date: lastTransaction.createdAt,
    returns: lastTransaction.totalAmountPaid,
    expenses: yesterdayExpenses.reduce(
      (total, expense) => total + expense.totalAmount,
      0
    ),
    numberOfJobs: lastTransaction.numberOfJobs,
  };

  return yesterdayData;
};

const generateDailyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { yesterdayData, todayData } = await getData(userId);

    const report = [];

    if (yesterdayData && Object.keys(yesterdayData).length > 0) {
      report.push({ date: yesterdayData.date, ...yesterdayData });
    }

    if (todayData && Object.keys(todayData).length > 0) {
      report.push({ date: todayData.date, ...todayData });
    }

    const comparisonNote = getComparisonNote(
      yesterdayData || {},
      todayData || {}
    );

    res.status(200).json({ report, comparisonNote });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getComparisonNote = (yesterdayData, todayData) => {
  const positiveSentences = [
    "Way to go! Your financial performance today is outstanding.",
    "You've done a fantastic job with your returns. Keep it up!",
    "Impressive! Today's financial results are excellent.",
    "Superb effort! Your returns today are truly remarkable.",
    "Amazing work on optimizing your spending. Your financial health is great.",
    "Brilliant job! Your positive financial trend continues today.",
    "Wonderful! Keep up the terrific work on your returns and expenses.",
    "Great job managing your finances today. Your efforts are paying off.",
    "Your financial performance is outstanding. You're on the right track.",
    "Today's financial results are superb. Keep the momentum going!",
  ];

  const negativeSentences = [
    "Today's financial data is concerning. Let's work on optimizing your spending.",
    "It's a bit alarming. Your returns today are not as expected. Let's analyze.",
    "Worrisome news. Your financial performance today is not up to the mark.",
    "Disappointing results today. We need to address your financial strategy.",
    "Today's financial data is troubling. Let's identify areas for improvement.",
    "Unsettling news. Your returns today are not meeting the desired targets.",
    "Disturbing trends in today's financial data. We need to reassess your strategy.",
    "Unfortunately, today's financial performance is not as expected. Let's analyze why.",
    "Regrettable news. Your returns and expenses today are not in sync with the goals.",
    "Dismal results today. It's time to revisit your financial strategy and make adjustments.",
  ];

  let selectedSentence;

  // Check if keys are found in both yesterdayData and todayData
  const yesterdayKeys = Object.keys(yesterdayData);
  const todayKeys = Object.keys(todayData);

  if (yesterdayKeys.length > 0 && todayKeys.length > 0) {
    const returnsDifference = todayData.returns - yesterdayData.returns;
    const expensesDifference = todayData.expenses - yesterdayData.expenses;

    if (returnsDifference > 0) {
      if (returnsDifference > 1000 || expensesDifference > 0) {
        selectedSentence = getRandomElement(positiveSentences);
      } else {
        selectedSentence = "Neutral comparison message";
      }
    } else {
      selectedSentence = getRandomElement(negativeSentences);
    }
  } else {
    // If keys are not found in either yesterdayData or todayData
    const dataWithKeys = yesterdayKeys.length > 0 ? yesterdayData : todayData;

    // Check if returns are greater than expenses
    if (dataWithKeys.returns > dataWithKeys.expenses) {
      selectedSentence = getRandomElement(positiveSentences);
    } else {
      selectedSentence = getRandomElement(negativeSentences);
    }
  }

  return selectedSentence;
};

const getRandomElement = (array) => {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

const getBarChartDetails = async (req, res) => {
  const year = 2023;
  const userId = req.user._id;

  try {
    const chartData = {
      returns: Array(12).fill(0),
      expenses: Array(12).fill(0),
    };

    await Promise.all(
      Array.from({ length: 12 }, async (_, monthIndex) => {
        const startDate = new Date(year, monthIndex, 1);
        const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999); // Set the end time to the last millisecond of the last day

        // Filter expenses for the month
        const monthExpenses = await DailyExpense.find({
          user: userId,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        });

        // Filter transactions for the month
        const monthTransactions = await Transaction.find({
          user: userId,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        });

        // Calculate total expenses for the month
        const totalExpenses = monthExpenses.reduce(
          (total, expense) => total + expense.totalAmount,
          0
        );

        // Calculate total returns for the month
        const totalReturns = monthTransactions.reduce(
          (total, transaction) => total + transaction.totalAmountPaid,
          0
        );

        // Update chartData arrays
        chartData.returns[monthIndex] = totalReturns;
        chartData.expenses[monthIndex] = totalExpenses;
      })
    );

    res.status(200).json({
      chartData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error fetching bar chart details" });
  }
};

const getDashboardDetails = async (req, res) => {
  const userId = req.user._id;
  console.log(userId);
  try {
    // Find all transactions for the user
    const transactions = await Transaction.find({ user: userId });

    // Find all expenses for the user
    const expenses = await DailyExpense.find({ user: userId });

    // Calculate total expenses
    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.totalAmount,
      0
    );

    // Calculate total transaction amount
    const totalTransactions = transactions.reduce(
      (total, transaction) => total + transaction.totalAmountPaid,
      0
    );

    // Calculate net amount
    const netAmount =
      totalTransactions + req.user.openingBalance - totalExpenses;

    // Prepare the response
    const dashboardDetails = {
      totalExpenses,
      totalTransactions,
      netAmount,
    };

    res.status(200).json(dashboardDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching dashboard details" });
  }
};

const generateWeeklyReport = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have the user ID in the request
    const userWorkingDays = req.user.workingDays || 7; // Assuming user's working days are stored in req.user.workingDays

    const weeksInMonth = getCompletedWeeksInMonth(userWorkingDays);

    console.log("weeksInMonth", weeksInMonth);

    const weeklyReport = [];

    for (const week of weeksInMonth) {
      const startDate = moment(week[0]);
      const endDate = moment(week[week.length - 1]);

      // Query transactions within the date range
      const transactions = await Transaction.find({
        user: userId,
        createdAt: { $gte: startDate, $lte: endDate.endOf("day").toDate() },
      }).sort({ createdAt: 1 });

      if (transactions.length > 0) {
        const report = generateReportFromWeek(transactions, startDate, endDate);
        weeklyReport.push(report);
      }
    }

    // Return the weekly report
    res.json({ report: weeklyReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to get the completed weeks in the previous month
const getCompletedWeeksInMonth = (year, month, workingDays) => {
  const weeks = [];
  const currentDay = moment(); // Use the current date

  let lastTransactionDate = moment(); // Assuming the last transaction date is the current date initially
  let weekNumber = 1;

  while (weekNumber <= 4) {
    const startDate = lastTransactionDate
      .clone()
      .startOf("week")
      .subtract(1, "day");

    // Adjust end date based on working days
    const endDate = lastTransactionDate
      .clone()
      .endOf("week")
      .subtract(1, "day")
      .subtract(workingDays === 7 ? 1 : 0, "days");

    const week = {
      week: weekNumber,
      sd: startDate.format("YYYY-MM-DD"),
      ed: endDate.format("YYYY-MM-DD"),
    };

    weeks.unshift(week); // Add the week to the beginning of the array
    weekNumber++;

    lastTransactionDate.subtract(1, "week");
  }

  return weeks;
};

// Helper function to generate a report from a week of transactions
const generateReportFromWeek = (transactions, startDate, endDate) => {
  const totalJobs = transactions.reduce(
    (acc, transaction) => acc + transaction.numberOfJobs,
    0
  );
  const totalExpenses = transactions.reduce(
    (acc, transaction) => acc + transaction.totalAmountPaid,
    0
  );
  const totalAmountMade = transactions.reduce(
    (acc, transaction) => acc + transaction.totalJobAmount,
    0
  );

  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate(),
    totalJobs,
    totalExpenses,
    totalAmountMade,
  };
};

const generateMonthlyReport = async (req, res) => {
  const userId = req.user._id;

  try {
    const currentDate = new Date();

    // Calculate the start and end dates for the current month
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // Find transactions within the specified month for the user
    const monthlyTransactions = await Transaction.find({
      user: userId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Calculate total amount of job paid
    const totalAmountPaid = monthlyTransactions.reduce((total, transaction) => {
      return total + transaction.totalAmountPaid;
    }, 0);

    // Filter expenses for the month
    const monthExpenses = await DailyExpense.find({
      user: userId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Calculate total expenses for the month
    const totalExpenses = monthExpenses.reduce(
      (total, expense) => total + expense.totalAmount,
      0
    );

    // Calculate the total number of jobs
    const totalJobs = monthlyTransactions.length;

    const report = {
      totalAmountPaid,
      totalExpenses,
      totalJobs,
      monthlyTransactions,
    };

    // Send the response with the monthly report
    res.status(200).json({ report });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const createJobsAndExpenses = async () => {
  console.log("Running");

  const userId = "65683bd4312811ff3337556d";

  try {
    const startDate = moment("2023-11-01"); // Change the start date as needed
    const endDate = moment(); // Current date

    const dateCursor = startDate.clone();

    const jobDataArray = [
      {
        customerName: "Kim",
        pickUp: "Ajah",
        delivery: [{ location: "Ipaja", amount: 4000, payer: "vendor" }],
      },
      // ... (other job data)
    ];

    while (dateCursor.isSameOrBefore(endDate)) {
      if (dateCursor.day() !== 0) {
        const currentDate = dateCursor.format("YYYY-MM-DD");
        console.log("Running", currentDate);

        const jobData =
          jobDataArray[
            (dateCursor.diff(startDate, "days") -
              dateCursor.diff(startDate.clone().startOf("week"), "days")) %
              jobDataArray.length
          ];

        // Create a new transaction for each day
        const transaction = new Transaction({
          user: userId,
          totalJobAmount: 0,
          numberOfPaidJobs: 0,
          numberOfJobs: 0,
          paymentStatus: "paid",
          totalAmountPaid: 0,
          jobs: [],
          createdAt: currentDate,
        });

        await transaction.save();

        console.log("=============");
        console.log("Transaction created", currentDate);

        const jobDetails = {
          transaction: transaction._id,
          customerName: jobData.customerName,
          pickUp: jobData.pickUp,
          amount: 0,
          payer: "",
          jobStatus: "done",
          paymentStatus: "paid",
          createdAt: moment(currentDate).startOf("day").toDate(), // Set createdAt to the start of the day
        };

        for (const delivery of jobData.delivery) {
          jobDetails.delivery = delivery.location;
          jobDetails.amount = Number(delivery.amount);
          jobDetails.payer = delivery.payer;

          const job = new Job(jobDetails);
          await job.save();

          transaction.jobs.push(job._id);
          transaction.totalJobAmount += jobDetails.amount;
          transaction.numberOfJobs++;
          transaction.numberOfPaidJobs++;
          transaction.paymentStatus = "paid";
          transaction.totalAmountPaid += jobDetails.amount;
          await transaction.save();
        }

        const expenseData = [
          { expense: "Data", amount: 500 },
          // Add more expenses as needed
        ];

        // Create a new daily expense for each day
        const dailyExpense = new DailyExpense({
          user: userId,
          expenses: expenseData,
          totalAmount: expenseData.reduce(
            (total, exp) => total + Number(exp.amount),
            0
          ),
          numberOfExpenses: expenseData.length,
          date: currentDate,
          createdAt: currentDate,
        });

        await dailyExpense.save();

        console.log("=============");
        console.log("Expense created", currentDate);
      }

      dateCursor.add(1, "day");
    }
  } catch (error) {
    console.error(error);
  }
};

const updateAllJobsInTransaction = async (req, res) => {
  const userId = req.user._id;
  const transactionId = req.params.id; // Assuming you're passing the ID in the URL params
  const { markDone, markPaid } = req.body; // Assuming you're sending these parameters in the request body

  try {
    // Fetch the transaction from the database
    const transaction = await Transaction.findById({
      _id: transactionId,
      user: userId,
    }).populate("jobs"); // Ensure the 'jobs' field is populated

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Check if jobs are already marked as "done" or "paid"
    if (markDone && transaction.jobs.every((job) => job.jobStatus === "done")) {
      // All jobs are already marked as "done", no need to update
      return res.status(200).json({
        message: "All jobs are already marked as 'done'. No update needed.",
        job: transaction,
      });
    }

    if (
      markPaid &&
      transaction.jobs.every((job) => job.paymentStatus === "paid")
    ) {
      // All jobs are already marked as "paid", no need to update
      return res.status(200).json({
        message: "All jobs are already marked as 'paid'. No update needed.",
        job: transaction,
      });
    }

    // Update the job properties based on parameters
    if (markDone) {
      for (const job of transaction.jobs) {
        if (job.jobStatus !== "done") {
          job.jobStatus = "done";
          await job.save(); // Save each updated job
        }
      }
    }

    if (markPaid) {
      for (const job of transaction.jobs) {
        if (job.paymentStatus !== "paid") {
          job.paymentStatus = "paid";
          await job.save(); // Save each updated job
        }
      }
    }

    // Update transaction properties based on the updated jobs
    transaction.totalAmountPaid = transaction.jobs.reduce(
      (total, job) =>
        job.paymentStatus === "paid" ? total + job.amount : total,
      0
    );
    transaction.numberOfPaidJobs = transaction.jobs.filter(
      (job) => job.paymentStatus === "paid"
    ).length;
    transaction.paymentStatus =
      transaction.numberOfPaidJobs === transaction.numberOfJobs
        ? "paid"
        : "not-paid";

    // Save the updated transaction
    await transaction.save();

    res
      .status(200)
      .json({ message: "Transaction updated successfully", job: transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getClients = async (req, res) => {
  const userId = req.user._id;

  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    const result = await paginateResults(
      { user: userId },
      Client,
      "_id",
      page,
      limit
    );

    res.status(200).json({ pagination: result, clients: result.results });
  } catch (error) {
    console.log(error);
  }
};

const fetchClients = async (req, res) => {
  const userId = req.user._id;

  try {
    const allClients = await Client.find({ user: userId });

    return res.status(200).json({ clients: allClients });
  } catch (error) {
    console.log("Error fetching clients", error);
    res.status(404).json({ error: error });
  }
};

const createClient = async (req, res) => {
  const { name, email, phone } = req.body.data;
  const userId = req.user._id;

  try {
    // Find or create the client based on the user and client name
    let client = await Client.findOne({ user: userId, name });

    if (!client) {
      client = new Client({
        user: userId,
        name,
        phone,
        email: email ? email : "",
        totalJobs: 0,
        lastJobDate: null,
        totalJobAmount: 0,
      });
      await client.save();
    }

    return res.status(200).json({ message: "Client created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
};

const updateProfile = async (req, res) => {
  const userId = req.user._id;
  const data = req.body.data;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, data, {
      new: true,
    });

    const transactions = await Transaction.find({ user: userId });

    // Calculate total transaction amount
    const totalTransactions = transactions.reduce(
      (total, transaction) => total + transaction.totalAmountPaid,
      0
    );

    res.status(200).json({
      user: { ...updatedUser._doc, totalAmount: totalTransactions },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

const verifyPassword = async (req, res) => {
  const user = req.user;
  const password = req.body.password;

  try {
    const isMatch = bcrypt.compare(password, user.password);
    // Return true if the passwords match, otherwise false
    res.status(200).json({ isMatch });
  } catch (error) {
    // Handle any errors during the password verification process
    console.error("Error verifying password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updatePassword = async (req, res) => {
  const user = req.user;
  const { oldPassword, newPassword } = req.body.data;

  try {
    // Check if the provided old password matches the stored hash
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect old password" });
    }

    // Hash the new password before updating it in the database
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    user.password = hashedNewPassword;

    await user.save();
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  viewJob,
  viewSingleJob,
  updateJob,
  deleteJob,
  uploadJob,
  getAllExpenses,
  createExpense,
  viewExpense,
  calculateMonthlyReport,
  getBarChartDetails,
  generateDailyReport,
  getDashboardDetails,
  generateWeeklyReport,
  createJobsAndExpenses,
  getClients,
  updateAllJobsInTransaction,
  fetchClients,
  createClient,
  generateMonthlyReport,
  updateProfile,
  verifyPassword,
  updatePassword,
};
