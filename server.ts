import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { of, fromEvent } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";
import {
  localFileChange$,
  PairChangePayload,
  PAIR_FILE_CHANGE_EVENT,
} from "./common";

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
  switchMap((socket) =>
    fromEvent(socket, PAIR_FILE_CHANGE_EVENT).pipe(
      map(([filename, diff]: PairChangePayload) => [socket, filename, diff] as const)
    )
  )
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

let lastChangeReceived = new Map<string, string>();
let lastChangeSent = new Map<string, string>();

onConnectAndThenLocalFileChange.subscribe(
  ({ socket, filename, diff: d, stat }) => {
    const diff = d.toString();
    if (
      diff !== lastChangeReceived.get(socket.id) &&
      diff !== lastChangeSent.get(socket.id)
    ) {
      console.log("emitting change", filename);
      socket.emit(PAIR_FILE_CHANGE_EVENT, filename, diff);
      lastChangeSent.set(socket.id, diff);
    }
  }
);

fileChangeReceived$.subscribe(([socket, filename, diff]) => {
  console.log("received change", filename);
  lastChangeReceived.set(socket.id, diff);
  shell.exec(`git checkout ${filename}`, { silent: true });
  shell.ShellString(diff).exec("git apply");
});

// start server

console.log("server listening on port 3000");
httpServer.listen(3000);
