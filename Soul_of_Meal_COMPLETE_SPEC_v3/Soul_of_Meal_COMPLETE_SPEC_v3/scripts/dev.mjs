import { spawn } from "node:child_process";
import { resolve } from "node:path";
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const port = option("--port", process.env.PORT ?? "4173");
const host = option("--host", "127.0.0.1");
const child = spawn(
  "python3",
  [
    "-m",
    "http.server",
    port,
    "--bind",
    host,
    "--directory",
    resolve(import.meta.dirname, ".."),
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
