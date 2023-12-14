require("dotenv").config();
const { jwtDecode } = require("jwt-decode");
const { User } = require("../model");

const checkUserAndVerifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwtDecode(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.user = user;
    console.log(user);

    // Check if the user is an admin
    if (user.role.includes("admin")) {
      // User is an admin, proceed to the next middleware or route
      next();
    } else {
      // User is not an admin, return an error response
      return res
        .status(403)
        .json({ error: "Permission denied. User is not an admin." });
    }
  } catch (error) {
    console.error(error);
    // Handle other errors or log them appropriately
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { checkUserAndVerifyAdmin };
