import { io } from "socket.io-client";
import { of, fromEvent } from "rxjs";
import { map, switchMap, takeUntil, tap } from "rxjs/operators";
import * as shell from "shelljs";
import {
  BRANCH_EVENT,
  localFileChange$,
  PairChangePayload,
  PAIR_FILE_CHANGE_EVENT,
} from "./common";
import * as yargs from "yargs";

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

process.chdir(shell.exec("git rev-parse --show-toplevel"));

const argv = yargs
  .option("force", {
    alias: "f",
    description: "Cleans up the working directory and puts it into stash",
    type: "boolean",
  })
  .help()
  .alias("help", "h")
  .parseSync();

// prepare working directory
const workingDirectoryDirty = shell
  .exec("git status --porcelain")
  .toString()
  .trim();
if (workingDirectoryDirty) {
  if (argv.force) {
    console.log("forcing to stash...");
    shell.exec("git stash --include-untracked");
  } else {
    console.log("Working directory not clean! Use --force to stash it?");
    process.exit(1);
  }
}

const [address = "http://localhost:3000/"] = argv._;

const socket$ = of(io(address as string));

const connection$ = socket$.pipe(
  switchMap((socket) => fromEvent(socket, "connect").pipe(map(() => socket))),
  switchMap((socket) =>
    fromEvent(socket, BRANCH_EVENT).pipe(
      map(([branch]) => ({ socket, branch }))
    )
  ),
);

const fileChangeReceived$ = connection$.pipe(
  switchMap(({ socket }) =>
    fromEvent<PairChangePayload>(socket, PAIR_FILE_CHANGE_EVENT)
  )
);

const onConnectAndThenLocalFileChange$ = connection$.pipe(
  switchMap(({ socket, branch }) =>
    localFileChange$.pipe(
      map((x) => ({ socket, ...x, branch })),
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

// initial sync
connection$.subscribe(
  (({ branch }) => {
    const fail = shell.exec(`git checkout ${branch}`).code;
    if (fail) {
      console.log(
        `branch '${branch}' not found, fetching and retrying to check it out`
      );
      shell.exec("git fetch");
      const fail = shell.exec(`git checkout ${branch}`).code;
      if (fail) {
        console.log(
          "Branch not found. Make sure the server has pushed the branched before starting the session."
        );
        process.exit(1);
      }
    }
  })
);

onConnectAndThenLocalFileChange$.subscribe(({ socket, filename, diff: d }) => {
  const diff = d.toString();
  if (lastChangeReceived !== diff && lastChangeSent !== diff) {
    console.log("emitting change", filename);
    socket.emit(PAIR_FILE_CHANGE_EVENT, filename, diff);
    lastChangeSent = diff;
  }
});

fileChangeReceived$.subscribe(([filename, diff]) => {
  console.log("received change", filename);
  lastChangeReceived = diff;
  shell.exec(`git checkout ${filename}`, { silent: true });
  shell.ShellString(diff).exec("git apply");
});
