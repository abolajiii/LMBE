require("dotenv").config();
const nodemailer = require("nodemailer");

const user = process.env.user;
const host = process.env.host;
const pass = process.env.pass;

const transport = nodemailer.createTransport({
  host,
  port: 465,
  secure: true,
  debug: true,
  logger: true,
  auth: {
    user,
    pass,
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

module.exports = { transport };
