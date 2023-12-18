const { User } = require("../model");

const getAllUsers = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  try {
    // Use the find method with a query to exclude the user with the username "admin"
    const users = await User.find({ username: { $ne: "admin" } }).sort({
      createdAt: -1,
    });

    // Use the countDocuments method with a query to count users with non-free plans
    const count = await User.countDocuments({
      username: { $ne: "admin" },
      plan: { $ne: "free" },
    });

    // Pagination information
    const totalItems = users.length;

    // Calculate the start and end indices for pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Get the results for the current page
    const results = users.slice(startIndex, endIndex);

    // Calculate pagination details
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = endIndex < totalItems;
    const hasPrev = startIndex > 0;

    return res.status(200).json({
      message: "Fetched all users successfully",
      users: results,
      count,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  getAllUsers,
};
