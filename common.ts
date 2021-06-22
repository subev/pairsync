import { Observable } from "rxjs";
import * as shell from "shelljs";

import * as chokidar from "chokidar";

// One-liner for current directory

export const localFileChange$ = new Observable<{
  filename: string;
  diff: shell.ShellString;
  stat: shell.ShellString;
}>((subscriber) => {
  const watcher = chokidar.watch(".").on("change", (filename) => {
    if (filename) {
      const diff = shell.exec(`git diff ${filename}`);
      const stat = shell.exec(`git diff --stat ${filename}`);

      subscriber.next({ filename, diff, stat });
    }
  });
  return () => {
    watcher.close();
  };
});

export const PAIR_FILE_CHANGE_EVENT = "pair-filechange";
