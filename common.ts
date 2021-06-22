import * as chokidar from "chokidar";
import * as fs from "fs";
import { Observable } from "rxjs";
import * as shell from "shelljs";

export const localFileChange$ = new Observable<{
  filename: string;
  diff: shell.ShellString;
  stat: shell.ShellString;
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
