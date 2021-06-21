import { io } from "socket.io-client";

const socket = io("http://localhost:3000/");

socket.on("connect", () => {
  console.log("connected to server");
  socket.on("pairchange", (pairchange) => console.log({ pairchange }));
  setInterval(() => {
    socket.emit("pairchange", "client-change emit");
  }, 1000);
});
