import { createServer } from "http";
import { Server, Socket } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  // ...
});

io.on("connection", (socket: Socket) => {
  console.log("client connected.", socket.id);
  socket.on("pairchange", (pairchange) => console.log({ pairchange }));
  setInterval(() => {
    socket.emit("pairchange", "server-change emit");
  }, 1000);
});

console.log("server listening on port 3000");
httpServer.listen(3000);
