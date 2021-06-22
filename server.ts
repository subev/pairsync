import { createServer } from "http";
import { Server, Socket } from "socket.io";
import * as fs from "fs";
import { of, fromEvent, Observable } from "rxjs";
import { filter, map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

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
      // tap((pairchange) => console.log({ socketid: socket.id, pairchange }))
    )
  )
);

const localfilechangewatch$ = new Observable<{
  filename: string;
  diff: shell.ShellString;
  stat: shell.ShellString;
}>((subscriber) => {
  const watcher = fs.watch(".", function (event, filename) {
    console.log({ event, filename });
    if (event === "change" && filename) {
      const diff = shell.exec(`git diff ${filename}`);
      const stat = shell.exec(`git diff --stat ${filename}`);

      subscriber.next({ filename, diff, stat });
    }
  });
  return () => {
    watcher.close();
  };
});

const onConnectAndThenFileChange = connection$.pipe(
  switchMap((socket) =>
    localfilechangewatch$.pipe(
      map((x) => ({ socket, ...x })),
      filter(({ diff }) => !!diff),
      takeUntil(
        fromEvent(socket, "disconnect").pipe(
          tap(() => console.log("disconnect"))
        )
      )
    )
  )
);

onConnectAndThenFileChange.subscribe(({ socket, filename, diff }) => {
  socket.emit("pair-filechange", filename, diff);
});

console.log("server listening on port 3000");
httpServer.listen(3000);
