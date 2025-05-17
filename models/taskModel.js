// Import mongoose for schema and model creation
const mongoose = require("mongoose");

// Define the schema for user-created tasks
const taskSchema = mongoose.Schema({
  // Task title — required field
  title: { type: String, required: true },

  // Optional task description
  description: { type: String },

  // Optional due date (format: YYYY-MM-DD)
  dueDate: { type: Date },

  // Optional due time stored as string (e.g. "14:30")
  dueTime: { type: String }, 

  // Task priority level — default is "low"
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },

  // Current status of the task — starts as "pending"
  status: {
    type: String,
    enum: ["pending", "inprogress", "completed"],
    default: "pending",
  },

  // How often the task should repeat — default is one-time
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly"],
    default: "once",
  },

  // ID of the user who owns/created this task
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },

  // Array to store logs or activity related to the task
  logs: { type: Array, default: [] },

}, {
  // Automatically adds createdAt and updatedAt fields
  timestamps: true
});

// Create the model using the defined schema
const taskModel = mongoose.model("task", taskSchema);

// Export the model to use elsewhere in the app
module.exports = taskModel;
