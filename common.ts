import { Observable } from "rxjs";
import * as shell from "shelljs";
import * as fs from "fs";

export const localFileChange$ = new Observable<{
  filename: string;
  diff: shell.ShellString;
  stat: shell.ShellString;
}>((subscriber) => {
  const watcher = fs.watch(".", function (event, filename) {
    console.log({ event, filename });
    if (event === "change" && filename) {
      const diff = shell.exec(`git diff ${filename}`);
      const stat = shell.exec(`git diff --stat ${filename}`);

      subscriber.next({ filename, diff, stat });
    }
  });
  return () => {
    watcher.close();
  };
});

