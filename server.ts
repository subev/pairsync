import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { of, fromEvent } from "rxjs";
import { map, mergeMap, switchMap, tap } from "rxjs/operators";
import * as shell from "shelljs";
import {
  localFileChange$,
  PairChangePayload,
  PAIR_FILE_CHANGE_EVENT,
  BRANCH_EVENT,
} from "./common";
import * as localtunnel from "localtunnel";

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

process.chdir(shell.exec("git rev-parse --show-toplevel").toString().trim());

const httpServer = createServer();
const io$ = of(
  new Server(httpServer, {
    // ...
  })
);

const connection$ = io$.pipe(
  switchMap((server) =>
    fromEvent(server, "connection").pipe<
      Socket,
      { socket: Socket; server: typeof server }
    >(
      tap<Socket>(({ id }) => console.log("client connected.", id)),
      // cant find a better way to infer the Socket type for this stream result
      map((socket: Socket) => ({ socket, server }))
    )
  )
);

const fileChangeReceived$ = connection$.pipe(
  mergeMap(({ socket }) =>
    fromEvent(socket, PAIR_FILE_CHANGE_EVENT).pipe(
      map(
        ([filename, diff]: PairChangePayload) =>
          [socket, filename, diff] as const
      )
    )
  )
);

const onConnectAndThenLocalFileChange = io$.pipe(
  switchMap((server) => localFileChange$.pipe(map((x) => ({ server, ...x }))))
);

// consumes

let lastChangeReceived = new Map<string, string>();
let lastChangeSent: string;

connection$.subscribe(({ socket }) =>
  socket.emit(BRANCH_EVENT, shell.exec("git rev-parse --abbrev-ref HEAD"))
);

onConnectAndThenLocalFileChange.subscribe(({ filename, diff: d, server }) => {
  const diff = d.toString();
  if (diff !== lastChangeSent) {
    console.log("emitting change", filename);
    server.emit(PAIR_FILE_CHANGE_EVENT, filename, diff);
    lastChangeSent = diff;
  }
});

fileChangeReceived$.subscribe(([socket, filename, diff]) => {
  console.log("received change", filename);
  lastChangeReceived.set(socket.id, diff);
  socket.broadcast.emit(PAIR_FILE_CHANGE_EVENT, diff);
  shell.exec(`git checkout ${filename}`, { silent: true });
  shell.ShellString(diff).exec("git apply");
});

// start server

localtunnel({ port: 3000 }).then((tunnel) => {
  console.log("server listening on port 3000");
  console.log(`client should connect to ${tunnel.url}`);
  httpServer.listen(3000);
});
