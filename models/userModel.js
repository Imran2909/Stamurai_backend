// Import mongoose to define the schema and create the model
const mongoose = require("mongoose");

// Define the user schema structure
const userSchema = mongoose.Schema({
  // Username is required (corrected typo: 'require' → 'required')
  username: { type: String, required: true },

  // User email — must be unique and required
  email: { type: String, required: true, unique: true },

  // Hashed password — required
  password: { type: String, required: true },

  // List of collaborators (probably user IDs or usernames) — required field
  collaborator: { type: Array, required: true },
});

// Create the model from the schema
const userModel = mongoose.model("user", userSchema);

// Export the model to use it in other parts of the app
module.exports = userModel;
