const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { connection } = require("./database/db");
const userRouter = require("./routes/userRoute");
const taskRouter = require("./routes/taskRoute");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);

// CORS config — allow frontend origin with credentials (cookies)
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Built-in middleware for JSON parsing & cookie parsing
app.use(express.json());
app.use(cookieParser());

// Simple home route for sanity check
app.get("/", (req, res) => {
  res.send("Home page for Stamurai");
});

// Public user routes (signup, login, logout)
app.use("/user", userRouter);

// Setup Socket.IO with CORS to match frontend
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Inject io into assignTaskRouter to enable socket event emission
const assignTaskRouter = require("./routes/assignTaskRouter")(io);

// Protect all routes below this middleware (require auth)
app.use(authMiddleware);

// Protected routes for task management and assignment
app.use("/task", taskRouter);
app.use("/assignTask", assignTaskRouter);

// Map to track connected users if needed later
const connectedUsers = new Map();

// Socket.IO connection events
io.on("connection", (socket) => {

  // Client joins a room named by their username
  socket.on("join", (username) => {
    socket.join(username);

    // Broadcast to all clients that a new user joined (including self)
    io.emit("new_user_joined", { username });
  });

  // Emit task assignments to specific user room
  socket.on("task-assign", ({ from, to, status, id }) => {
    io.to(to).emit("task-assign", { from, to, status, id });
  });

  // Handle disconnect if you want (optional)
  socket.on("disconnect", () => {
    // You could remove user from connectedUsers here if tracked
  });
});

// Start server and connect to DB
server.listen(5000, async () => {
  try {
    await connection;
    console.log("Connected to DB");
  } catch (error) {
    console.log("Cannot connect to DB");
  }
  console.log(`Server is running on port 5000`);
});
