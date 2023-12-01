require("dotenv").config();

const jwt = require("jsonwebtoken");
const { User } = require("../model"); // Import your User model

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.MY_AUTH_TOKEN_SECRET_KEY); // Change to your JWT secret

    // Check if the token has expired
    if (Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ error: "Token has expired." });
    }

    const user = await User.findById(decoded?.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.user = user; // Attach the user object to the request
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token.", error });
  }
};

module.exports = { authMiddleware };
