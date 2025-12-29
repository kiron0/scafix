# Scafix

A universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.

## Installation

```bash
npm install -g scafix
```

Or use with npx (no installation required):

```bash
npx scafix
```

## Usage

### Interactive Mode

Simply run Scafix without any arguments:

```bash
npx scafix
```

This will prompt you to:
1. Select a stack
2. Enter a project name
3. Choose a directory
4. Select a package manager
5. Optionally initialize a Git repository

### Command Mode

Create a project with a specific stack:

```bash
npx scafix create <stack>
```

Examples:

```bash
npx scafix create vite-react
npx scafix create next
npx scafix create express
```

### Init Command

Use the `init` command for interactive mode:

```bash
npx scafix init
```

## Supported Stacks

| Stack ID   | Description                    | Backend |
| ---------- | ------------------------------ | ------- |
| vite-react | Vite + React + TypeScript      | No      |
| next       | Next.js + TypeScript           | Yes     |
| express    | Node.js + Express + TypeScript | Yes     |

## Options

### Global Flags

- `--help` - Show help information
- `--version` - Show version number
- `--yes` / `-y` - Accept defaults without prompts
- `--debug` - Enable debug output

### Create Command Options

- `-n, --name <name>` - Project name
- `-d, --directory <dir>` - Project directory
- `--package-manager <pm>` - Package manager (npm, pnpm, yarn)
- `--git` - Initialize Git repository

## Examples

### Create a Vite + React project

```bash
npx scafix create vite-react --name my-app
```

### Create a Next.js project with pnpm

```bash
npx scafix create next --name my-next-app --package-manager pnpm
```

### Create an Express project with Git initialization

```bash
npx scafix create express --name my-api --git
```

### Non-interactive mode (accept defaults)

```bash
npx scafix create vite-react --name my-app --yes
```

## Architecture

Scafix acts as a thin orchestration layer over existing tools:

- **Vite React**: Uses `npm create vite@latest`
- **Next.js**: Uses `npx create-next-app@latest`
- **Express**: Creates a minimal Express setup with TypeScript

Each stack is implemented as a self-contained adapter, making it easy to add new stacks without modifying core CLI logic.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run build:watch

# Format code
npm run format
```

## License

MIT
