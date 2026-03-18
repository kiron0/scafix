import { existsSync } from "fs";
import { join } from "path";
import validatePackageName from "validate-npm-package-name";
import { logger } from "./logger.js";

export function validateProjectName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    logger.error("Project name cannot be empty");
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) {
    logger.error("Project name contains invalid characters");
    return false;
  }

  // Check for reserved names
  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];
  if (reservedNames.includes(name.toUpperCase())) {
    logger.error("Project name is a reserved Windows name");
    return false;
  }

  return true;
}

export function validateNpmPackageName(name: string): boolean {
  const trimmedName = name.trim();

  if (!trimmedName) {
    logger.error("Package name cannot be empty");
    return false;
  }

  if (name !== trimmedName) {
    logger.error("Package name cannot have leading or trailing whitespace");
    return false;
  }

  if (trimmedName !== trimmedName.toLowerCase()) {
    logger.error("Package name must be lowercase");
    return false;
  }

  const validationResult = validatePackageName(trimmedName);
  if (!validationResult.validForNewPackages) {
    const issues = [
      ...(validationResult.errors ?? []),
      ...(validationResult.warnings ?? []),
    ];
    logger.error(
      issues[0] ?? "Package name is not valid for a new npm package",
    );
    if (issues.length > 1) {
      logger.debug(`Package name validation details: ${issues.join("; ")}`);
    }
    return false;
  }

  return true;
}

export function getDefaultDirectoryName(projectName: string): string {
  const trimmedName = projectName.trim();
  if (trimmedName.startsWith("@") && trimmedName.includes("/")) {
    const segments = trimmedName.split("/");
    return segments[segments.length - 1] || trimmedName;
  }

  return trimmedName;
}

export function checkDirectoryExists(directory: string): boolean {
  return existsSync(directory);
}

export function validateDirectory(directory: string): {
  valid: boolean;
  exists: boolean;
  path: string;
} {
  const fullPath = join(process.cwd(), directory);
  const exists = checkDirectoryExists(fullPath);

  return {
    valid: true,
    exists,
    path: fullPath,
  };
}
