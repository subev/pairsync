import { io } from "socket.io-client";
import { of, fromEvent, Observable } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";
import { localFileChange$ } from "./common";

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
  switchMap((socket) => fromEvent(socket, "pair-filechange"))
);

const onConnectAndThenFileChange = connection$.pipe(
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

fileChangeReceived$.subscribe(([filename, diff]) => {
  console.log({ filename, diff });
  shell.exec(`git checkout ${filename}`)
  shell.ShellString(diff).exec("git apply");
});

onConnectAndThenFileChange.subscribe(({ socket, filename, diff }) => {
  socket.emit("pair-filechange", filename, diff);
});
