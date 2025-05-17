const express = require("express");
const assignTaskModel = require("../models/assignTaskModel");
const userModel = require("../models/userModel");

module.exports = function (io) {
  const assignTaskRouter = express.Router();

  // Helper to create consistent log entries
  const createLog = (action, userId) => ({
    action,
    user: userId,
    timestamp: new Date(),
  });

  // ======================== SOCKET.IO ========================
  io.on("connection", (socket) => {
    // Join a specific room (usually username-based)
    socket.on("join", (username) => {
      socket.join(username);
    });

    // Accept task assignment
    socket.on("accept-task", async (info) => {
      try {
        const { id: taskId, from, to } = info;

        const task = await assignTaskModel
          .findById(taskId)
          .populate("sentBy", "username")
          .populate("sendTo", "username");

        if (!task) return socket.emit("error", { message: "Task not found" });
        if (task.assignStatus !== "requested") {
          return socket.emit("error", { message: "Task is not in requested state" });
        }

        const sender = await userModel.findOne({ username: from });
        const receiver = await userModel.findOne({ username: to });

        if (!sender || !receiver) {
          return socket.emit("error", { message: "Sender or receiver not found" });
        }

        // Add receiver to sender's collaborator list
        if (!sender.collaborator.includes(receiver.username)) {
          sender.collaborator.push(receiver.username);
          await sender.save();
        }

        // Update task status and log the action
        task.assignStatus = "assigned";
        task.logs.push({
          action: "Task accepted",
          date: new Date(),
          by: receiver._id,
        });

        await task.save();

        // Notify sender about acceptance
        io.to(from).emit("taskRequestSuccess", {
          accepted: true,
          message: `${to} accepted your task request`,
          task,
        });

      } catch (err) {
        console.error("Socket accept-task error:", err);
        socket.emit("error", { message: "Internal server error" });
      }
    });

    // Reject task assignment
    socket.on("reject-task", async (info) => {
      try {
        const { id: taskId, from, to } = info;

        const task = await assignTaskModel
          .findById(taskId)
          .populate("sentBy", "username")
          .populate("sendTo", "username");

        if (!task) return socket.emit("error", { message: "Task not found" });
        if (task.assignStatus !== "requested") {
          return socket.emit("error", { message: "Task is not in requested state" });
        }

        const sender = await userModel.findOne({ username: from });
        const receiver = await userModel.findOne({ username: to });

        if (!sender || !receiver) {
          return socket.emit("error", { message: "Sender or receiver not found" });
        }

        task.assignStatus = "rejected";
        task.logs.push({
          action: "Task Rejected",
          date: new Date(),
          by: receiver._id,
        });

        await task.save();

        // Notify sender about rejection
        io.to(from).emit("taskRequestReject", {
          accepted: false,
          message: `${to} rejected your task request`,
          task,
        });

      } catch (err) {
        console.error("Socket reject-task error:", err);
        socket.emit("error", { message: "Internal server error" });
      }
    });

    // Handle disconnects if needed
    socket.on("disconnect", () => {});
  });

  // ======================== REST ROUTES ========================

  // Get assigned and received tasks
  assignTaskRouter.get("/", async (req, res) => {
    try {
      const userId = req.userId;

      const sent = await assignTaskModel
        .find({ sentBy: userId })
        .populate("sentBy", "username")
        .populate("sendTo", "username");

      const received = await assignTaskModel
        .find({ sendTo: userId, assignStatus: { $ne: "rejected" } })
        .populate("sentBy", "username")
        .populate("sendTo", "username");

      res.status(200).json({ sent, received });
    } catch (error) {
      console.log("Failed to get tasks:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a new task assignment
  assignTaskRouter.post("/", async (req, res) => {
    try {
      const {
        title,
        description,
        dueDate,
        dueTime,
        priority,
        status,
        frequency,
        sendTo,
      } = req.body;

      const sentBy = req.userId;

      const senderUser = await userModel.findById(sentBy);
      const receiverUser = await userModel.findOne({ username: sendTo });

      if (!receiverUser) return res.status(404).json({ message: "Recipient user not found" });
      if (receiverUser._id.equals(sentBy)) {
        return res.status(400).json({ message: "Cannot assign task to yourself" });
      }

      const isCollaborator = receiverUser.collaborator.includes(senderUser.username);

      const newTask = new assignTaskModel({
        title,
        description,
        dueDate,
        dueTime,
        priority,
        status,
        frequency,
        sentBy,
        sendTo: receiverUser._id,
        assignStatus: isCollaborator ? "assigned" : "requested",
        logs: [
          {
            action: isCollaborator ? "Task assigned" : "Task request sent",
            date: new Date(),
            by: senderUser._id,
            to: receiverUser._id,
          },
        ],
      });

      await newTask.save();

      res.status(201).json({
        message: `Task ${newTask.assignStatus} to ${receiverUser.username}`,
        status: newTask.assignStatus,
        task: newTask,
      });

    } catch (err) {
      console.error("Error assigning task:", err);
      res.status(500).json({ message: "Server error while assigning task" });
    }
  });

  // Update an assigned task
  assignTaskRouter.put("/edit/:id", async (req, res) => {
    try {
      const taskId = req.params.id;
      const userId = req.userId;
      const user = await userModel.findById(userId);
      const updates = req.body;

      const task = await assignTaskModel.findById(taskId);
      if (!task) return res.status(404).json({ message: "Assigned task not found" });

      Object.assign(task, updates);
      task.logs.push(createLog("edited", userId));

      const sender = await userModel.findById(task.sentBy);
      const reciever = await userModel.findById(task.sendTo);
      const to = sender.username === user.username ? reciever.username : sender.username;

      io.emit("Update-task", {
        task,
        doneBy: user.username,
        to,
        act: updates.assignStatus,
      });

      await task.save();
      res.status(200).json({ message: "Assigned task updated", task });

    } catch (error) {
      res.status(500).json({
        message: "Failed to update assigned task",
        error: error.message,
      });
    }
  });

  // Soft-delete an assigned task
  assignTaskRouter.delete("/delete/:id", async (req, res) => {
    try {
      const userId = req.userId;
      const user = await userModel.findById(userId);
      const taskId = req.params.id;

      const deletedTask = await assignTaskModel.findByIdAndUpdate(
        taskId,
        {
          $push: {
            logs: createLog("deleted", userId),
          },
          assignStatus: "deleted",
        },
        { new: true }
      );

      if (!deletedTask) return res.status(404).json({ message: "Assigned task not found" });

      const sender = await userModel.findById(deletedTask.sentBy);
      const reciever = await userModel.findById(deletedTask.sendTo);
      const to = sender.username === user.username ? reciever.username : sender.username;

      io.emit("Delete-task", { deletedTask, doneBy: user.username, to });

      res.status(200).json({
        message: "Assigned task soft-deleted",
        task: deletedTask,
      });

    } catch (error) {
      res.status(500).json({
        message: "Failed to delete assigned task",
        error: error.message,
      });
    }
  });

  return assignTaskRouter;
};
