import { io } from "socket.io-client";
import { of, fromEvent } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";
import { localFileChange$, PAIR_FILE_CHANGE_EVENT } from "./common";

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

const socket$ = of(io("http://localhost:3000/"));

const connection$ = socket$.pipe(
  switchMap((socket) =>
    fromEvent(socket, "connect").pipe(
      tap(() => console.log("connected to server")),
      map(() => socket)
    )
  )
);

const fileChangeReceived$ = connection$.pipe(
  switchMap((socket) => fromEvent(socket, PAIR_FILE_CHANGE_EVENT))
);

const onConnectAndThenLocalFileChange$ = connection$.pipe(
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

onConnectAndThenLocalFileChange$.subscribe(
  ({ socket, filename, diff: d, stat }) => {
    const diff = d.toString();
    console.log("localchange", { diff, lastChangeReceived });
    if (lastChangeReceived !== diff && lastChangeSent !== diff) {
      socket.emit(PAIR_FILE_CHANGE_EVENT, filename, diff);
      lastChangeSent = diff;
    }
  }
);

fileChangeReceived$.subscribe(([filename, diff]) => {
  console.log("received change", filename);
  lastChangeReceived = diff;
  shell.exec(`git checkout ${filename}`, { silent: true });
  shell.ShellString(diff).exec("git apply --reject");
});
