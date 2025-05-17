// Import mongoose to define and interact with MongoDB schemas
const mongoose = require("mongoose");

// Define the schema for assigning tasks between users
const assignTaskSchema = mongoose.Schema({
  // Task title is required
  title: { type: String, required: true },

  // Optional description for additional task details
  description: { type: String }, 

  // Optional due date for when the task should be done
  dueDate: { type: Date },

  // Optional time for the due date, stored as a string in HH:mm format
  dueTime: { type: String }, 

  // Priority level of the task with default set to "low"
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },

  // Current status of the task — pending by default
  status: {
    type: String,
    enum: ["pending", "inprogress", "completed"],
    default: "pending",
  },

  // How often the task recurs — default is "once"
  frequency: {
    type: String,
    enum: ["once", "daily", "weekly", "monthly"],
    default: "once",
  },

  // The user who sent or assigned the task
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  }, 

  // The user who receives the task
  sendTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },

  // Tracks the assignment status — like whether it's been accepted, rejected, etc.
  assignStatus: {
    type: String,
    enum: ["requested", "assigned", "rejected"],
    default: "requested", // (you may want to double-check this default value — maybe should be "requested"?)
  },

  // Logs for tracking task-related activities or history
  logs: { type: Array, default: [] },

}, {
  // Adds createdAt and updatedAt timestamps automatically
  timestamps: true
});

// Create the model from the schema
const assignTaskModel = mongoose.model("assignTask", assignTaskSchema);

// Export the model to use in other parts of the app
module.exports = assignTaskModel;
