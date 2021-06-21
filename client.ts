import { io } from "socket.io-client";
import { of, fromEvent, Observable } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";

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

const filechangereceived$ = connection$.pipe(
  switchMap((socket) => fromEvent(socket, "pair-filechange"))
);

filechangereceived$.subscribe(([filename, diff]) =>
  console.log({ filename, diff })
);
