import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "--config", "vitest.smoke.config.ts"],
  {
    env: {
      ...process.env,
      SCAFIX_RUN_NETWORK_SMOKE: "1",
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
