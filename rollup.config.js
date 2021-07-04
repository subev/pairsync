// rollup.config.js
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "client.ts",
    output: {
      dir: "output",
      format: "cjs",
    },
    plugins: [typescript()],
    external: [
      "socket.io-client",
      "rxjs",
      "rxjs/operators",
      "shelljs",
      "yargs",
      "fs",
      "chokidar",
    ],
  },
  {
    input: "server.ts",
    output: {
      dir: "output",
      format: "cjs",
    },
    plugins: [typescript()],
    external: [
      "localtunnel",
      "http",
      "socket.io",
      "rxjs",
      "rxjs/operators",
      "shelljs",
      "fs",
      "chokidar",
    ],
  },
];
