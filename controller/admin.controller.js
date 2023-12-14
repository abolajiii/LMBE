const { User } = require("../model");

const getAllUsers = async (req, res) => {
  const users = await User.find({});

  return res
    .status(200)
    .json({ message: "Fetched All users successfully", users });
};

module.exports = {
  getAllUsers,
};
