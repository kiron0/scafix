export const ESLINT_PACKAGE = 'eslint@^8.57.1';
export const TYPESCRIPT_ESLINT_PARSER_PACKAGE = '@typescript-eslint/parser@^8.46.1';
export const TYPESCRIPT_ESLINT_PLUGIN_PACKAGE = '@typescript-eslint/eslint-plugin@^8.46.1';

export function getEslintPackages(options: { typescript: boolean }): string[] {
  const packages = [ESLINT_PACKAGE];

  if (options.typescript) {
    packages.push(TYPESCRIPT_ESLINT_PARSER_PACKAGE, TYPESCRIPT_ESLINT_PLUGIN_PACKAGE);
  }

  return packages;
}
