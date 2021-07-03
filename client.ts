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
const silent = true;

if (!shell.which("git")) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
}

process.chdir(shell.exec("git rev-parse --show-toplevel", { silent }).trim());

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
    `Connected to server. Server is streaming on branch ${branch}:${sha}`
  );
  const currentSha = shell.exec("git rev-parse HEAD", { silent }).trim();
  const currentBranch = shell
    .exec("git rev-parse --abbrev-ref HEAD", { silent })
    .trim();
  console.log(`This client is using branch ${currentBranch}:${currentSha}`);
  if (sha === currentSha && branch === currentBranch) {
    console.log("Good! No revision syncing needed!");
    return;
  }

  if (shell.exec(`git show ${sha}`, { silent }).code) {
    console.log("Revision not found locally, tring to fetch");
    shell.exec(`git fetch`, { silent });
    if (shell.exec(`git show ${sha}`, { silent }).code) {
      console.log(
        "Revision ${sha} not found even after fetching, please make sure server has pushed his work to the remote!"
      );
      process.exit(1);
    }
  }

  if (branch !== currentBranch) {
    if (shell.exec(`git checkout ${branch}`, { silent }).code) {
      console.log(`Branch not found creating new one named ${branch}`);
      if (shell.exec(`git checkout -b ${branch}`).code) {
        console.log(`Problem creating new branch ${branch}`);
        process.exit(1);
      }
    }
  }
  if (shell.exec(`git reset --hard ${sha}`, { silent }).code) {
    console.log(`Failed checking out ${branch}:${sha}`);
  }

  console.log(`Successfully synced to track ${branch}:${sha}`);
});

onConnectAndThenLocalFileChange$.subscribe(
  ({ socket, filename, diff: d, isNew }) => {
    const diff = d.toString();
    if (lastChangeReceived !== diff && lastChangeSent !== diff) {
      console.log("emitting change", filename);
      socket.emit(PAIR_FILE_CHANGE_EVENT, { filename, diff, isNew });
      lastChangeSent = diff;
    }
  }
);

fileChangeReceived$.subscribe(({ filename, diff, isNew }) => {
  console.log(
    isNew ? "untracked file updated" : "tracked file updated",
    filename
  );
  lastChangeReceived = diff;
  if (isNew) {
    shell.ShellString(diff).exec(`>> ${filename}`);
  } else {
    shell.exec(`git checkout ${filename}`, { silent });
    shell.ShellString(diff).exec("git apply");
  }
});

console.log("Waiting to connect to server...");
