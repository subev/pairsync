import { createServer } from "http";
import { Server, Socket } from "socket.io";
import * as fs from "fs";
import { of, fromEvent, Observable } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";

const httpServer = createServer();
const io$ = of(
  new Server(httpServer, {
    // ...
  })
);

const connection$ = io$.pipe(
  switchMap((socket) =>
    fromEvent(socket, "connection").pipe(
      tap(({ id }) => console.log("client connected.", id)),
      // cant find a better way to infer the Socket type for this stream result
      map((s: Socket) => s)
    )
  )
);

const filechangereceived$ = connection$.pipe(
  switchMap((socket) =>
    fromEvent(socket, "pairchange").pipe(
      tap((pairchange) => console.log({ socketid: socket.id, pairchange }))
    )
  )
);

const localfilechangewatch$ = new Observable((subscriber) => {
  const watcher = fs.watch(".", function (event, filename) {
    console.log({ event, filename });
    if (event === "change" && filename) {
      subscriber.next(filename);
    }
  });
  return () => {
    watcher.close();
  };
});

const onConnectAndThenFileChange = connection$.pipe(
  switchMap((socket) =>
    localfilechangewatch$.pipe(
      map((localfile) => ({ socket, localfile })),
      takeUntil(
        fromEvent(socket, "disconnect").pipe(
          tap(() => console.log("disconnect"))
        )
      )
    )
  )
);

onConnectAndThenFileChange.subscribe(({ socket, localfile }) => {
  socket.emit("pair-filechange", localfile);
});

console.log("server listening on port 3000");
httpServer.listen(3000);
