const paginateResults = async (
  query,
  model,
  populateField,
  page = 1,
  limit = 10
) => {
  try {
    const totalItems = await model.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const results = await model
      .find(query)
      .populate(populateField)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      totalItems,
      totalPages,
      currentPage: page,
      hasNext,
      hasPrev,
      itemsInPage: results.length,
      results,
    };
  } catch (error) {
    console.error(error);
    throw new Error("Error during pagination");
  }
};

const paginateExpense = async (model, page = 1, limit = 10) => {
  const totalItems = model.expenses.length;
  const totalPages = Math.ceil(totalItems / limit);

  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const results = model.expenses.slice(startIndex, endIndex);

  const hasNext = endIndex < totalItems;
  const hasPrev = startIndex > 0;

  return {
    totalItems,
    totalPages,
    currentPage: page,
    hasNext,
    hasPrev,
    itemsInPage: results.length,
    results,
  };
};

module.exports = {
  paginateResults,
  paginateExpense,
};
