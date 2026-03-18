import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const name = packageJson.name;

export const APP_CONFIG = {
  name,
  displayName: name.charAt(0).toUpperCase() + name.slice(1),
  version: packageJson.version,
  description:
    "A universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.",
  thankYouMessage: `Thank you for using ${name.charAt(0).toUpperCase() + name.slice(1)}!`,
} as const;
