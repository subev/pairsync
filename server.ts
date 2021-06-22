import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { of, fromEvent } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";
import { localFileChange$, PAIR_FILE_CHANGE_EVENT } from "./common";

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

const fileChangeReceived$ = connection$.pipe(
  switchMap((socket) => fromEvent(socket, PAIR_FILE_CHANGE_EVENT))
);

const onConnectAndThenLocalFileChange = connection$.pipe(
  switchMap((socket) =>
    localFileChange$.pipe(
      map((x) => ({ socket, ...x })),
      takeUntil(
        fromEvent(socket, "disconnect").pipe(
          tap(() => console.log("disconnect"))
        )
      )
    )
  )
);

// consumes

let lastChangeReceived: string;
let lastChangeSent: string;

onConnectAndThenLocalFileChange.subscribe(
  ({ socket, filename, diff: d, stat }) => {
    const diff = d.toString();
    console.log("localChange emit", {
      diff: diff,
      lastchangeReceived: lastChangeReceived,
    });
    if (diff !== lastChangeReceived && diff !== lastChangeSent) {
      socket.emit(PAIR_FILE_CHANGE_EVENT, filename, diff);
      lastChangeSent = diff;
    }
  }
);

fileChangeReceived$.subscribe(([filename, diff]) => {
  console.log("received change", filename);
  lastChangeReceived = diff;
  shell.exec(`git checkout ${filename}`, { silent: true });
  shell.ShellString(diff).exec("git apply", { silent: true });
});

// start server

console.log("server listening on port 3000");
httpServer.listen(3000);
