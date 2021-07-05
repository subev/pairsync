import * as chokidar from "chokidar";
import * as fs from "fs";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { merge } from "rxjs";

import * as shell from "shelljs";

export type PairChangePayload = {
  filename: string;
  diff: string;
  untracked?: true;
};
const silent = true;

export const PAIR_FILE_CHANGE_EVENT = "pair-filechange";
export const BRANCH_EVENT = "branch";
const newLineRegex = /\r?\n/;
const trimTrailingSlash = (x: string) => x.replace(/\/$/, "");
const trimleadingSlash = (x: string) => x.replace(/^\//, "");

export const localFileChange$ = new Observable<PairChangePayload>(
  (subscriber) => {
    const ignored = [
      ".git",
      ...(fs.existsSync(".gitignore")
        ? fs
            .readFileSync(".gitignore")
            .toString()
            .split(newLineRegex)
            .filter((x) => x && !x.startsWith("#"))
            .map(trimTrailingSlash)
            .map(trimleadingSlash)
        : []),
    ];
    const watcher = chokidar
      .watch(".", { ignored, ignoreInitial: true })
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
              untracked: true,
            });
          }
        } else {
          // if tracked
          if (event === "change") {
            const diff = shell.exec(`git diff -- ${filename}`, { silent });

            subscriber.next({ filename, diff });
          }
        }
      });
    return () => {
      watcher.close();
    };
  }
);

export const initialServerChangesStream = () =>
  merge(
    // untracked
    from(
      shell
        .exec("git ls-files --others --exclude-standard", { silent })
        .split(newLineRegex)
        .filter(Boolean)
    ).pipe(
      map<string, PairChangePayload>((filename) => ({
        filename,
        diff: fs.readFileSync(filename).toString(),
        untracked: true,
      }))
    ),
    // unstaged
    from(
      shell
        .exec("git diff HEAD --name-only", { silent })
        .split(newLineRegex)
        .filter(Boolean)
    ).pipe(
      map<string, PairChangePayload>((filename) => ({
        filename,
        diff: shell.exec(`git diff HEAD -- ${filename}`, { silent }),
      }))
    )
  );
