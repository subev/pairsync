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

process.chdir(shell.exec("git rev-parse --show-toplevel").toString().trim());

const argv = yargs
  .option("force", {
    alias: "f",
    description: "Cleans up the working directory and puts it into stash",
    type: "boolean",
  })
  .help()
  .alias("help", "h")
  .parseSync(process.argv.slice(2));

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
      map(([branch, sha]) => ({ socket, branch, sha }))
    )
  )
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
connection$.subscribe(({ branch, sha }) => {
  console.log(
    `Server is streaming branch ${branch}:${sha}, checking it out'`
  );
  const branchOrRevisionMissing =
    shell.exec(`git checkout ${branch}`).code ||
    shell.exec(`git show ${sha}`).code;
  if (branchOrRevisionMissing) {
    console.log(
      `Branch '${branch}' or revision '${sha}' not found, trying to fetch...`
    );
    shell.exec("git fetch");
    if (shell.exec(`git show ${sha}`).code) {
      console.log(
        "Revision not found. Make sure the server has pushed the branched before starting the session"
      );
      process.exit(1);
    } else {
      if (shell.exec(`git checkout ${branch}`).code) {
        console.log(`Branch not found creating new one named ${branch}`);
        if (shell.exec(`git branch ${branch}`).code) {
          console.log(`Problem creating new branch ${branch}`);
          process.exit(1);
        }
      }
    }
  }
  if (
    shell.exec(`git checkout ${branch}`).code ||
    shell.exec(`git reset --hard ${sha}`).code
  ) {
    console.log(`Failed checking out ${branch}:${sha}`);
  }

  console.log(`Successfully synced to track ${branch}:${sha}`);
});

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
