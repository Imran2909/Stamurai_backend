const express = require("express");
const taskRouter = express.Router();
const Task = require("../models/taskModel");
const authMiddleware = require("../middleware/authMiddleware");

// Utility: Creates a log object to track task actions
const createLog = (action, userId) => ({
  action,
  user: userId,
  timestamp: new Date(),
});

// ========== ROUTES ==========

// 1. POST /create — Create a new personal task
taskRouter.post("/create", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId; // Authenticated user ID

    const {
      title,
      description,
      dueDate,
      dueTime,
      priority,
      status,
      frequency,
    } = req.body;

    const newTask = new Task({
      title,
      description,
      dueDate,
      dueTime,
      priority,
      status,
      frequency,
      userId,
      logs: [createLog("created", userId)],
    });

    await newTask.save();

    res.status(201).json({ message: "Task created successfully", task: newTask });
  } catch (error) {
    res.status(500).json({ message: "Failed to create task", error: error.message });
  }
});

// 2. GET /all — Get all tasks of the logged-in user (no soft-delete filter)
taskRouter.get("/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const tasks = await Task.find({ userId });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
});

// 3. GET / — Get only active (non-deleted) tasks of the user
taskRouter.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const tasks = await Task.find({
      userId,
      $or: [
        { logs: { $not: { $elemMatch: { action: "deleted" } } } }, // Exclude deleted
        { logs: { $exists: false } }, // Edge case: no logs
      ],
    });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
});

// 4. PATCH /update/:id — Update a task and log the action
taskRouter.patch("/update/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const taskId = req.params.id;
    const updateData = req.body;

    // Push update log as part of the update
    updateData.$push = {
      logs: createLog("updated", userId),
    };

    const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
    });

    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ message: "Task updated", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Failed to update task", error: error.message });
  }
});

// 5. DELETE /delete/:id — Soft-delete a task by adding a 'deleted' log
taskRouter.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const taskId = req.params.id;

    const deletedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        $push: {
          logs: createLog("deleted", userId),
        },
        status: "completed", // Optional: also mark status for UI reference
      },
      { new: true }
    );

    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ message: "Task soft-deleted", task: deletedTask });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete task", error: error.message });
  }
});

module.exports = taskRouter;
