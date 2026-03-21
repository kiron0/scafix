import { spawn } from "node:child_process";

const packageManagers = (() => {
  const index = process.argv.indexOf("--package-managers");
  return index >= 0 ? process.argv[index + 1] : undefined;
})();

const profile = (() => {
  const index = process.argv.indexOf("--profile");
  return index >= 0 ? process.argv[index + 1] : undefined;
})();

const child = spawn(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "--config", "vitest.smoke.config.ts"],
  {
    env: {
      ...process.env,
      ...(packageManagers ? { SCAFIX_SMOKE_PACKAGE_MANAGERS: packageManagers } : {}),
      ...(profile ? { SCAFIX_SMOKE_PROFILE: profile } : {}),
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
