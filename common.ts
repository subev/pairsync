import * as chokidar from "chokidar";
import * as fs from "fs";
import { Observable } from "rxjs";
import * as shell from "shelljs";

export type PairChangePayload = [filename: string, diff: string];

export const PAIR_FILE_CHANGE_EVENT = "pair-filechange";
export const BRANCH_EVENT = "branch";

export const localFileChange$ = new Observable<{
  filename: string;
  diff: shell.ShellString;
}>((subscriber) => {
  const ignored = [
    ".git",
    ...(fs.existsSync(".gitignore")
      ? fs
          .readFileSync(".gitignore")
          .toString()
          .split("\n")
          .filter((x) => x)
      : []),
  ];
  console.log({ ignored });
  const watcher = chokidar.watch(".", { ignored }).on("change", (filename) => {
    if (filename) {
      const diff = shell.exec(`git diff ${filename}`, { silent: true });

      subscriber.next({ filename, diff });
    }
  });
  return () => {
    watcher.close();
  };
});
