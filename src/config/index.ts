import packageJson from "../../package.json";

const appName = packageJson.name;
const appDisplayName = appName.charAt(0).toUpperCase() + appName.slice(1);

export const APP_CONFIG = {
  name: appName,
  displayName: appDisplayName,
  version: packageJson.version,
  description:
    "A universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.",
  thankYouMessage: `Thank you for using ${appDisplayName}!`,
} as const;
