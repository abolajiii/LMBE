require("dotenv").config();
const { jwtDecode } = require("jwt-decode");
const { User } = require("../model");
const { RefreshToken } = require("../model"); // Import your RefreshToken model

// ... (existing code)

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwtDecode(token);
    if (Date.now() >= decoded.exp * 1000) {
      const refreshToken = req.body.refreshToken;

      if (refreshToken) {
        const decodedRefreshToken = jwtDecode(refreshToken);

        if (Date.now() >= decodedRefreshToken.exp * 1000) {
          return res.status(401).json({ error: "Refresh token has expired." });
        }

        const existingToken = await RefreshToken.findOne({
          token: refreshToken,
          user: decoded.userId,
        });

        if (!existingToken) {
          return res.status(401).json({ error: "Invalid refresh token." });
        }

        req.user = await User.findById(decoded.userId);
        next();
      }
    } else {
      req.user = await User.findById(decoded.userId);
      next();
    }
  } catch (error) {
    console.error(error);
    // Handle other errors or log them appropriately
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ... (existing code)

module.exports = { authMiddleware };
