const express = require("express");
const app = express();
const path = require("path");

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index");
});

let waitingusers = [];
let rooms = []; // Store rooms as an array of objects

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  console.log(`Total users connected: ${io.engine.clientsCount}.`);
  console.log(`Total rooms: ${rooms.length}`);
  // Handle user joining a room
  socket.on("joinroom", () => {
    if (waitingusers.length > 0) {
      let partner = waitingusers.shift(); // Get the first waiting user
      const roomname = `${socket.id}-${partner.id}`;

      // Create a room
      rooms.push({
        roomname: roomname,
        users: [socket.id, partner.id],
      });

      // Join both users to the room
      socket.join(roomname);
      partner.join(roomname);

      // Notify users of the room
      io.to(roomname).emit("joined", roomname);
      console.log(`Room created: ${roomname}. Total rooms: ${rooms.length}`); // Log total rooms after creation
    } else {
      waitingusers.push(socket);
    }
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id} \n`); //
    console.log(
      `Total users connected: ${io.engine.clientsCount}. Total rooms: ${rooms.length}`
    );
    // Remove from waitingusers if applicable
    let waitingIndex = waitingusers.findIndex(
      (waitingUser) => waitingUser.id === socket.id
    );
    if (waitingIndex !== -1) {
      waitingusers.splice(waitingIndex, 1);
      console.log(`User ${socket.id} removed from waiting list`);
      return; // Stop if the user was only in the waiting list
    }

    // Find the room the user was part of
    let roomIndex = rooms.findIndex((room) => room.users.includes(socket.id));
    if (roomIndex !== -1) {
      const room = rooms[roomIndex];
      const remainingUserID = room.users.find((id) => id !== socket.id);

      // Remove the room
      rooms.splice(roomIndex, 1);

      // Handle the remaining user
      const remainingUserSocket = io.sockets.sockets.get(remainingUserID);
      if (remainingUserSocket && remainingUserSocket.connected) {
        if (waitingusers.length > 0) {
          let newPartner = waitingusers.shift();
          const newRoomname = `${remainingUserID}-${newPartner.id}`;

          // Create a new room
          rooms.push({
            roomname: newRoomname,
            users: [remainingUserID, newPartner.id],
          });

          // Join both users to the new room
          remainingUserSocket.join(newRoomname);
          newPartner.join(newRoomname);

          // Notify users of the new room
          io.to(newRoomname).emit("joined", newRoomname);
          console.log(
            `New room created: ${newRoomname}. Total rooms: ${rooms.length}`
          ); // Log total rooms after creation
        } else {
          // Add remaining user to the waiting list
          waitingusers.push(remainingUserSocket);
          console.log(`User ${remainingUserID} added to waiting list`);
          console.log(`Total rooms: ${rooms.length}`);
        }
      }
    }
  });

  socket.on("signalingMessage", function (data) {
    // console.log(data.room, data.message);
    socket.broadcast.to(data.room).emit("signalingMessage", data.message);
  });
});

// Render the homepage

// Start the server
server.listen(3000, () => {
  console.log("Server is running on port 3000: http://localhost:3000");
});
