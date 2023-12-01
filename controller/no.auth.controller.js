const { User, RefreshToken, Transaction, OTP } = require("../model");
const bcrypt = require("bcrypt");
const { generateAuthTokens, generateOtp } = require("../helper");
const path = require("path");
const ejs = require("ejs");
const { transport } = require("../config/nodemailer.config");

const forgotTemplatePath = path.join(
  __dirname,
  "../templates",
  "forgot.password.ejs"
);
const welcomeTemplatePath = path.join(__dirname, "../templates", "welcome.ejs");

const loginUser = async (userInfo) => {
  const { emailOrUsername, password } = userInfo;

  try {
    // Check if the user exists by username or email
    const user = await User.findOne({
      $or: [{ username: emailOrUsername }, { email: emailOrUsername }],
    });

    if (!user) {
      throw new Error("Invalid username or email");
    }

    // Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new Error("Invalid username or email");
    }

    return user;
  } catch (error) {
    throw error;
  }
};

const createNewUser = async (user) => {
  const { username, email, password, businessName, location } = user;

  try {
    // // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      businessName,
      location,
      openingBalance: 0,
    });

    await newUser.save();

    return newUser;
  } catch (error) {
    throw error;
  }
};

const signInUser = async (req, res) => {
  const userData = req.body.data;

  try {
    const user = await loginUser(userData);

    // Update the user's "last active" timestamp in the database
    // await User.findByIdAndUpdate(user._id, { lastActive: currentTime });

    // Delete existing refresh tokens for the user
    await RefreshToken.deleteMany({ user: user._id });

    // Generate tokens
    const { refreshToken, accessToken } = generateAuthTokens(user);

    // Create a new instance of RefreshToken
    const newRefreshToken = new RefreshToken({
      token: refreshToken,
      user: user._id,
    });

    // Save the new RefreshToken instance
    await newRefreshToken.save();

    const transactions = await Transaction.find({ user: user._id });

    // Calculate total transaction amount
    const totalTransactions = transactions.reduce(
      (total, transaction) => total + transaction.totalAmountPaid,
      0
    );

    res.json({
      user: { ...user._doc, totalAmount: totalTransactions },
      token: { refreshToken, accessToken },
    });
  } catch (error) {
    // console.log(error);
    res.status(400).json({ error: error.message });
  }
};

// Function to send the welcome email
const sendWelcomeEmail = async (user) => {
  const from = process.env.user;

  const emailData = {
    from,
    to: user.email,
    subject: "Welcome to Logistics Manager",
  };

  // Render the EJS template
  ejs.renderFile(welcomeTemplatePath, { user }, (err, data) => {
    if (err) {
      console.log("EJS rendering error: ", err);
    } else {
      // Email content
      emailData.html = data;

      transport.sendMail(emailData, (error, info) => {
        if (error) {
          console.log("Error sending email:", error.message);
        } else {
          console.log("Welcome Email sent:", info.response);
        }
      });
    }
  });
};

// Function to send the email
const sendOtpToEmail = async (user, otp, res) => {
  const from = process.env.user;

  const emailData = {
    from,
    to: user?.email,
    subject: "Password Reset OTP - Logistics Manager",
  };

  // Render the EJS template
  ejs.renderFile(forgotTemplatePath, { user, otp }, (err, data) => {
    if (err) {
      console.log("EJS rendering error: ", err);
    } else {
      // Email content
      emailData.html = data;

      transport.sendMail(emailData, (error, info) => {
        if (error) {
          console.log("Error sending email:", error);
          res.status(500).json({ message: "Failed to send OTP email" });
        } else {
          console.log("Email sent:", info.response);
          res.json({ message: "OTP sent successfully" });
        }
      });
    }
  });
};

const signUpUser = async (req, res) => {
  const user = req.body.data;

  try {
    const newUser = await createNewUser(user);

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(newUser);

    // Create a new instance of RefreshToken
    const newRefreshToken = new RefreshToken({
      token: refreshToken,
      user: newUser._id,
    });

    // Save the new RefreshToken instance
    await newRefreshToken.save();

    // Send the welcome email
    await sendWelcomeEmail(newUser);
    console.log(user);
    res.json({
      user,
      token: { refreshToken, accessToken },
    });
  } catch (error) {
    // console.log("Error creating user:", error);
    res.status(400).json({ error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  // Extract the email from the request body
  const { email } = req.body;
  console.log(email);
  // Generate a random OTP
  const otp = await generateOtp();
  console.log(otp);

  // Check if the email exists in your database (pseudocode)
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "Email not found" });
  }

  // Check if an OTP entry with the email already exists
  let otpEntry = await OTP.findOne({ email });

  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 15);

  if (!otpEntry) {
    // If no OTP entry exists, create a new one
    otpEntry = new OTP({ email, otp, expiresAt: expirationTime });
  } else {
    // If an OTP entry already exists, update it with a new OTP and expiration time
    otpEntry.otp = otp;
    otpEntry.expiresAt = expirationTime;
  }

  // Save the OTP entry
  await otpEntry.save();

  await sendOtpToEmail(user, otp, res);
};

const verifyOtp = async (req, res) => {
  // Extract the email and OTP from the request body
  const { email, otp } = req.body;

  try {
    // Find the OTP entry associated with the provided email
    const otpEntry = await OTP.findOne({ email });

    if (!otpEntry) {
      return res.status(404).json({ error: "OTP not found" });
    }

    // Check if the OTP is correct and has not expired
    const isOtpValid = otpEntry.otp === otp && new Date() < otpEntry.expiresAt;

    if (isOtpValid) {
      // OTP is valid, you can mark it as used or delete it
      // Later in your code when you want to remove it
      await OTP.findOneAndDelete({ email: otpEntry.email });
      // You can send a success response to the client
      res.json({ message: "OTP verification successful" });
    } else {
      // OTP is invalid or expired
      res.status(400).json({ error: "Invalid OTP" });
    }
  } catch (error) {
    // OTP is invalid or expired
    res.status(500).json({ error });
  }
};

const changePassword = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the email exists in your database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Email not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password with the hashed password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

module.exports = {
  signInUser,
  signUpUser,
  verifyEmail,
  verifyOtp,
  changePassword,
};
