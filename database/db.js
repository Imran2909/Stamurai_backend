// Importing mongoose to interact with MongoDB
const mongoose = require("mongoose");

// Load environment variables from .env file
require("dotenv").config();

// Establishing the MongoDB connection using the URL from environment variables
const connection = mongoose.connect(process.env.MONGO_URL);

// Exporting the connection so it can be reused throughout the app
module.exports = {
    connection
};
