<div align="center">

# Scafix

A universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.

For the best, most up-to-date guides and examples, see `Scafix` docs: [https://scafix.js.org](https://scafix.js.org)

</div>

## Installation

```bash
npm install -g scafix
```

Or use with npx (no installation required):

```bash
npx scafix
```

## Usage

```bash
# Interactive mode
npx scafix

# Interactive mode with shared root flags
npx scafix --name my-app --directory apps/my-app --package-manager pnpm

# Create a project (interactive official CLIs where available)
npx scafix create <stack>

# Examples
npx scafix --name api-starter --directory services/api
npx scafix create vite
npx scafix create vite --name web-app --package-manager bun
npx scafix create next --name dashboard --yes --package-manager pnpm
npx scafix create next
npx scafix create express
npx scafix create npm
```

## License

MIT
