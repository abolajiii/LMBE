require("dotenv").config();
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const path = require("path");
// Function to generate an authentication token and a refresh token
const generateAuthTokens = (user) => {
  // Define the payload for the tokens
  const payload = {
    userId: user._id,
    email: user.email,
    // Add any additional data you want to include in the tokens
  };

  // Generate the authentication token
  const accessToken = jwt.sign(payload, process.env.MY_AUTH_TOKEN_SECRET_KEY, {
    expiresIn: "15m",
  });

  // Generate the refresh token
  const refreshToken = jwt.sign(
    payload,
    process.env.MY_AUTH_TOKEN_REFRESH_KEY,
    {
      expiresIn: "7d",
    }
  );

  return { accessToken, refreshToken };
};

const generateOtp = (num = 6) => {
  let otp = "";
  for (let i = 0; i < num; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
};

const generateSampleExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet 1");

  // Add sample data and headers
  worksheet.columns = [
    { header: "Delivery", key: "delivery", width: 15 },
    { header: "Payer", key: "payer", width: 15 },
    { header: "Amount", key: "amount", width: 15 },
  ];

  worksheet.addRow({ delivery: "lekki", payer: "pick up", amount: 3000 });
  worksheet.addRow({ delivery: "ikotun", payer: "vendor", amount: 2500 });
  worksheet.addRow({ delivery: "yaba", payer: "delivery", amount: 2000 });
  // Add more rows as needed

  const filePath = path.join(__dirname, "sample.xlsx");
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};

module.exports = { generateAuthTokens, generateOtp, generateSampleExcel };
