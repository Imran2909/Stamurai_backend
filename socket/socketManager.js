function setupSocketServer(io) {
  io.on("connection", (socket) => {
    console.log("⚡ [SERVER] New socket connected:", socket.id);

    // When any client sends 'new_user_joined' event
    socket.on("new_user_joined", (userId) => {
      console.log(`🔔 [SERVER] New user joined: ${userId}`);
      
      // Broadcast to all other clients
      socket.broadcast.emit("user_joined_notification", userId);
    });
  });
}

module.exports = { setupSocketServer };