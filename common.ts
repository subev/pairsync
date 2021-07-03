import * as chokidar from "chokidar";
import * as fs from "fs";
import { Observable } from "rxjs";
import * as shell from "shelljs";

export type PairChangePayload = {
  filename: string;
  diff: string;
  isNew?: true;
};
const silent = true;

export const PAIR_FILE_CHANGE_EVENT = "pair-filechange";
export const BRANCH_EVENT = "branch";

export const localFileChange$ = new Observable<{
  filename: string;
  diff: string;
  isNew?: true;
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
  const watcher = chokidar
    .watch(".", { ignored })
    .on("all", (event, filename) => {
      const isNotTracked = shell.exec(
        `git ls-files --error-unmatch ${filename}`,
        { silent }
      ).code;

      if (isNotTracked) {
        if (event === "add" || event === "change") {
          subscriber.next({
            filename,
            diff: fs.readFileSync(filename).toString(),
            isNew: true,
          });
        }
      } else {
        // if tracked
        if (event === "change") {
          const diff = shell.exec(`git diff ${filename}`, { silent });

          subscriber.next({ filename, diff });
        }
      }
    });
  return () => {
    watcher.close();
  };
});
