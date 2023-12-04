const {
  Client,
  Job,
  Transaction,
  DailyExpense,
  User,
  RefreshToken,
} = require("../model");
const XLSX = require("xlsx");
const { paginateResults, paginateExpense } = require("../utils");
const bcrypt = require("bcrypt");
const { generateAuthTokens, generateSampleExcel } = require("../helper");

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
      client.totalJobAmount += jobDetails.amount; // Update totalJobAmount based on the transaction
    }

    await transaction.save();

    // Update client details outside the loop
    client.totalJobs += data.delivery.length;
    client.lastJobDate = new Date();
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

      const lastJobDate = await Job.findOne(
        { _id: { $in: transaction.jobs } },
        {},
        { sort: { createdAt: -1 } }
      );

      // Update client details
      const client = await Client.findOne({ name: deletedJob.customerName });
      if (client) {
        client.totalJobs -= 1;
        client.totalJobAmount -= Number(deletedJob.amount);
        client.lastJobDate = lastJobDate ? lastJobDate.createdAt : null;
        await client.save();
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
          (row.Payer || row.payer) &&
          (row.Amount || row.amount)
      )
    ) {
      return res.status(400).json({
        error:
          "Excel file must contain 'Delivery', 'Payer', and 'Amount' columns with non-empty values.",
      });
    }

    const mapPayer = (payer) => {
      const lowerPayer = payer.toLowerCase();
      if (lowerPayer.includes("pick up") || lowerPayer.includes("pickup")) {
        return "pick-up";
      } else if (lowerPayer.includes("vendor")) {
        return "vendor";
      } else if (lowerPayer.includes("delivery")) {
        return "delivery";
      } else if (lowerPayer === "pick-up") {
        return "pick-up";
      }
      // Handle additional mappings or variations as needed
      return lowerPayer; // Default to the lowercase payer value
    };

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
      const jobDetails = {
        transaction: transaction._id,
        customerName,
        pickUp,
        delivery: row.Delivery || row.delivery,
        amount: Number(row.Amount || row.amount) || 0,
        payer: mapPayer(row.Payer || row.payer),
        jobStatus: "pending",
        paymentStatus: "not-paid",
      };
      // Update job details for each row

      // Save the job details to the database
      const job = new Job(jobDetails);
      await job.save();

      // Update the transaction properties
      transaction.jobs.push(job._id);
      transaction.totalJobAmount += jobDetails.amount;
      transaction.numberOfJobs++;
      transaction.paymentStatus = "not-paid";
      client.totalJobAmount += jobDetails.amount; // Update totalJobAmount based on the transaction
      await transaction.save();
    }
    // Update client details
    client.totalJobs += data.length; // Increment totalJobs by the number of deliveries
    client.lastJobDate = new Date();
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

const getTransactionsAndExpenses = async (weeklyReports, userId) => {
  try {
    const results = await Promise.all(
      weeklyReports.map(async (week) => {
        const startOfWeek = new Date(week.date.start);
        const endOfWeek = new Date(week.date.end);

        // Set start of the day
        startOfWeek.setHours(0, 0, 0, 0);
        // Set end of the day
        endOfWeek.setHours(23, 59, 59, 999);

        // Get transactions for the week
        const transactions = await Transaction.find({
          createdAt: {
            $gte: startOfWeek,
            $lte: endOfWeek,
          },
          user: userId,
        });

        const totalAmount = transactions.reduce(
          (total, transaction) => total + transaction.totalAmountPaid,
          0
        );

        // console.log(transactions);

        // Get expenses for the week
        const expenses = await DailyExpense.find({
          date: {
            $gte: startOfWeek.toISOString().split("T")[0],
            $lte: endOfWeek.toISOString().split("T")[0],
          },
          user: userId,
        });

        return {
          week: week.week,
          date: [startOfWeek, endOfWeek],
          returns: totalAmount,
          numberOfJobs: transactions.reduce(
            (totalJobs, transaction) => totalJobs + transaction.numberOfJobs,
            0
          ),
          expenses: expenses.reduce(
            (total, expense) => total + expense.totalAmount,
            0
          ),
        };
      })
    );

    return results;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const generateWeeklyArray = async (
  workingDaysPerWeek = 6,
  numberOfWeeks = 5,
  currentDate = new Date()
) => {
  const weekReports = [];

  for (let week = 1; week <= numberOfWeeks; week++) {
    // Calculate the start of the week (Monday)
    let mondayFromCurrentDate = new Date(currentDate);
    mondayFromCurrentDate.setDate(
      currentDate.getDate() - ((currentDate.getDay() + 6) % 7)
    );

    // Calculate the end of the week (Saturday)
    const numberOfDays = workingDaysPerWeek === 6 ? 5 : 6;

    let saturdayFromCurrentDate = new Date(mondayFromCurrentDate);
    saturdayFromCurrentDate.setDate(
      mondayFromCurrentDate.getDate() + numberOfDays
    );

    weekReports.push({
      week,
      date: {
        start: mondayFromCurrentDate.toISOString().split("T")[0],
        end: saturdayFromCurrentDate.toISOString().split("T")[0],
      },
    });

    // Move to the next week
    currentDate = new Date(saturdayFromCurrentDate);
    currentDate.setDate(currentDate.getDate() - 7);

    // console.log({ currentDate: currentDate.toISOString().split("T")[0] });
  }
  return weekReports; // Return the modified array
};

const generateWeeklyReport = async (req, res) => {
  try {
    const allWeeks = await generateWeeklyArray();

    const transactionAndExpenses = await getTransactionsAndExpenses(
      allWeeks,
      req.user._id
    );

    const newTransactions = transactionAndExpenses.filter(
      (each) => each.numberOfJobs !== 0
    );

    res.status(200).json({ report: newTransactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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

const updateAllJobsInTransaction = async (req, res) => {
  const userId = req.user._id;
  const transactionId = req.params.id;
  const { markDone, markPaid } = req.body;

  try {
    const transaction = await Transaction.findById({
      _id: transactionId,
      user: userId,
    }).populate({
      path: "jobs",
      options: { sort: { createdAt: -1 } }, // Sort jobs by createdAt in descending order
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (markDone && transaction.jobs.every((job) => job.jobStatus === "done")) {
      return res.status(200).json({
        message: "All jobs are already marked as 'done'. No update needed.",
        job: transaction,
      });
    }

    if (
      markPaid &&
      transaction.jobs.every((job) => job.paymentStatus === "paid")
    ) {
      return res.status(200).json({
        message: "All jobs are already marked as 'paid'. No update needed.",
        job: transaction,
      });
    }

    if (markDone) {
      for (const job of transaction.jobs) {
        if (job.jobStatus !== "done") {
          job.jobStatus = "done";
          await job.save();
        }
      }
    }

    if (markPaid) {
      for (const job of transaction.jobs) {
        if (job.paymentStatus !== "paid") {
          job.paymentStatus = "paid";
          await job.save();
        }
      }
    }

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

const verifyRefreshToken = async (req, res) => {
  // console.log(req.body.refreshToken);

  // Check if the "Authorization" header is present in the request
  if (!req.headers.authorization) {
    return res.status(401).json({ message: "Authorization header missing" });
  }
  try {
    // Step 1: Check if the refresh token exists in the database
    const existingToken = await RefreshToken.findOne({
      token: req.body.refreshToken,
    });

    if (!existingToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Step 2: Check if the refresh token is associated with a valid user
    const userId = existingToken.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Step 3: Check if the existing refresh token has expired
    if (
      existingToken.expirationDate &&
      Date.now() >= existingToken.expirationDate
    ) {
      return res.status(401).json({ message: "Refresh token has expired" });
    }

    // Generate tokens
    const { refreshToken, accessToken } = generateAuthTokens(user);

    // Create a new instance of RefreshToken
    const newRefreshToken = new RefreshToken({
      token: refreshToken,
      user: user._id,
    });

    // Save the new RefreshToken instance
    await newRefreshToken.save();

    // Return a success response
    res.status(200).json({
      message: "Refresh token is valid",
      valid: true,
      token: { refreshToken, accessToken },
    });
  } catch (error) {
    console.error("Error verifying refresh token:", error);
    res.status(500).json({ message: "Internal server error", valid: false });
  }
};

const downloadExcelSample = async (req, res) => {
  try {
    const filePath = await generateSampleExcel();
    res.download(filePath, "jobsample.xlsx");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const filterJobs = async (req, res) => {
  const id = req.params.id;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const jobStatusFilter = req.query.jobStatus; // Assuming jobStatus is provided as a query parameter

  try {
    // Find the transaction by ID and populate the jobs
    const transaction = await Transaction.findById(id).populate("jobs");

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Filter jobs based on jobStatus if provided
    const filteredJobs = jobStatusFilter
      ? transaction.jobs.filter((job) => job.jobStatus === jobStatusFilter)
      : transaction.jobs;

    // Paginate the results
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    // Prepare pagination information
    const totalItems = filteredJobs.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = endIndex < totalItems;
    const hasPrev = startIndex > 0;

    const result = {
      totalItems,
      totalPages,
      currentPage: page,
      hasNext,
      hasPrev,
      itemsInPage: paginatedJobs.length,
      results: paginatedJobs,
    };

    // Send the response with the populated data and pagination information
    return res
      .status(200)
      .json({ job: transaction, jobs: result.results, pagination: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const filterAllJobs = async (req, res) => {
  const userId = req.user._id;
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const jobStatusFilter = req.query.paymentStatus; //

  try {
    // Find the transaction by ID and populate the jobs
    const transaction = await Transaction.find({
      user: userId,
    }).sort({
      createdAt: -1,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Filter jobs based on jobStatus if provided
    const filteredJobs = jobStatusFilter
      ? transaction.filter((job) => job.paymentStatus === jobStatusFilter)
      : transaction;

    // Paginate the results
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    // Prepare pagination information
    const totalItems = filteredJobs.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = endIndex < totalItems;
    const hasPrev = startIndex > 0;

    const result = {
      totalItems,
      totalPages,
      currentPage: page,
      hasNext,
      hasPrev,
      itemsInPage: paginatedJobs.length,
      results: paginatedJobs,
    };

    // Send the response with the populated data and pagination information
    return res.status(200).json({ jobs: result.results, pagination: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
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
  getClients,
  updateAllJobsInTransaction,
  fetchClients,
  createClient,
  generateMonthlyReport,
  updateProfile,
  verifyPassword,
  updatePassword,
  verifyRefreshToken,
  downloadExcelSample,
  filterJobs,
  filterAllJobs,
};
