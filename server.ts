import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { of, fromEvent, concat } from "rxjs";
import { map, mergeMap, switchMap, tap } from "rxjs/operators";
import * as shell from "shelljs";
import {
  localFileChange$,
  PairChangePayload,
  PAIR_FILE_CHANGE_EVENT,
  BRANCH_EVENT,
  initialServerChangesStream,
} from "./common";
import * as localtunnel from "localtunnel";
import { writeFileSync } from "fs";
const silent = true;

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

process.chdir(shell.exec("git rev-parse --show-toplevel", { silent }).trim());

const httpServer = createServer();
const io$ = of(
  new Server(httpServer, {
    // ...
  })
);

const connection$ = io$.pipe(
  switchMap((server) =>
    fromEvent(server, "connection").pipe(
      map((socket: Socket) => ({ socket, server }))
    )
  )
);

const fileChangeReceived$ = connection$.pipe(
  mergeMap(({ socket }) =>
    fromEvent(socket, PAIR_FILE_CHANGE_EVENT).pipe(
      map((x: PairChangePayload) => ({ ...x, socket }))
    )
  )
);

const onConnectAndThenSyncThenLocalFileChange$ = connection$.pipe(
  switchMap(({ server }) =>
    concat(
      initialServerChangesStream().pipe(
        tap(({ filename }) => console.log(filename))
      ),
      localFileChange$
    ).pipe(map((x) => ({ server, ...x })))
  )
);

// consumes

let lastChangeReceived: string;
let lastChangeSent: string;

connection$.subscribe(({ socket }) => {
  const sha = shell.exec("git rev-parse HEAD", { silent }).trim();
  const branch = shell
    .exec("git rev-parse --abbrev-ref HEAD", { silent })
    .trim();
  socket.emit(BRANCH_EVENT, branch, sha);
  console.log(
    `Client ${socket.id} connected and asked to track ${branch}:${sha}`
  );
  socket.on("disconnect", () =>
    console.log(`Client ${socket.id} disconnected`)
  );
});

concat(onConnectAndThenSyncThenLocalFileChange$).subscribe(
  ({ filename, diff: d, server, untracked }) => {
    const diff = d.toString();
    if (diff !== lastChangeSent && diff !== lastChangeReceived) {
      console.log("emitting change", filename);
      server.emit(PAIR_FILE_CHANGE_EVENT, { filename, diff, untracked });
      lastChangeSent = diff;
    }
  }
);

fileChangeReceived$.subscribe(({ socket, filename, diff, untracked }) => {
  console.log(
    untracked
      ? "received untracked file update"
      : "received tracked file update",
    filename
  );
  lastChangeReceived = diff;
  socket.broadcast.emit(PAIR_FILE_CHANGE_EVENT, { filename, diff, untracked });
  if (untracked) {
    writeFileSync(filename, diff);
  } else {
    shell.exec(`git checkout ${filename}`, { silent });
    shell.ShellString(diff).exec("git apply");
  }
});

// start server

localtunnel({ port: 3000 }).then((tunnel) => {
  console.log("server listening on port 3000");
  console.log(`clients should connect to ${tunnel.url}`);
  httpServer.listen(3000);
});
