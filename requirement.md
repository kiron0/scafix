# Scafix — Requirements Specification

## 1. Overview

**Scafix** is a universal scaffolding CLI that initializes modern application stacks through a single, consistent interface.

It acts as a **thin orchestration layer** over existing tools (e.g. Vite, Next.js, Express), ensuring:

- predictable project structure
- sensible defaults
- minimal abstraction
- future extensibility

Scafix must **not reinvent frameworks** — it coordinates them.

---

## 2. Goals

### Primary Goals

- Provide a single CLI entry point for scaffolding multiple stacks
- Offer both **interactive** and **command-based** usage
- Maintain zero lock-in: generated projects must be editable without Scafix
- Ensure fast execution and minimal dependencies

### Non-Goals

- Replacing framework CLIs
- Managing runtime dependencies
- Acting as a project generator with custom DSLs
- Providing opinionated architectural enforcement after scaffolding

---

## 3. CLI Usage Requirements

### Entry Point

```bash
npx scafix
```

### Command Mode

```bash
npx scafix create <stack>
npx scafix init
```

### Interactive Mode

If no command or stack is provided:

- Prompt user to select a stack
- Prompt for project name
- Prompt for optional features

---

## 4. Supported Stacks (Initial)

| Stack ID   | Description                    | Backend |
| ---------- | ------------------------------ | ------- |
| vite-react | Vite + React + TypeScript      | No      |
| next       | Next.js + TypeScript           | Yes     |
| express    | Node.js + Express + TypeScript | Yes     |

Each stack must be implemented as a **self-contained adapter**.

---

## 5. Architecture Requirements

### High-Level Architecture

```
scafix/
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts
│   │   └── create.ts
│   ├── adapters/
│   │   ├── vite-react.adapter.ts
│   │   ├── next.adapter.ts
│   │   └── express.adapter.ts
│   ├── prompts/
│   │   └── select-stack.ts
│   ├── utils/
│   │   ├── exec.ts
│   │   ├── logger.ts
│   │   └── validate.ts
│   └── types/
│       └── stack.ts
```

---

## 6. Adapter System Requirements

### Adapter Interface

Each stack adapter **must implement**:

```ts
interface StackAdapter {
  id: string;
  name: string;
  description: string;

  detect?: () => boolean;
  create(options: CreateOptions): Promise<void>;
}
```

### Adapter Rules

- Adapters must call official CLIs when available
- Adapters must not hardcode versions unless necessary
- Adapters must be independently testable
- Adding a new stack must not require changes to existing adapters

---

## 7. Execution Requirements

### Command Execution

- Use Node.js child processes
- Stream output directly to terminal
- Fail fast on errors
- Preserve original CLI output

### Error Handling

- Clear error messages
- No stack traces by default
- `--debug` flag enables verbose output

---

## 8. Interactive Prompts

### Required Prompts

- Stack selection
- Project name
- Directory confirmation

### Optional Prompts (Stack-Specific)

- TypeScript (if not default)
- ESLint / Prettier
- Package manager (npm / pnpm / yarn)

Prompt logic must be **owned by the adapter** when stack-specific.

---

## 9. Configuration & Flags

### Global Flags

```bash
--help
--version
--yes        # accept defaults
--debug
```

### Stack-Specific Flags

- Must be namespaced or documented
- Must not conflict across stacks

---

## 10. File System Requirements

- Scafix must never overwrite files without confirmation
- Generated projects must be clean Git repositories (optional `--git`)
- No global configuration files required

---

## 11. Performance Requirements

- CLI startup time < 200ms
- No unnecessary dynamic imports
- Dependencies must be minimal and justified

---

## 12. Security Requirements

- No remote code execution outside official CLIs
- No telemetry by default
- No user data storage

---

## 13. Testing Requirements

### Required Tests

- Adapter unit tests
- CLI command parsing tests
- Error handling tests

### Optional Tests

- Snapshot tests for prompts
- Integration tests (mocked CLIs)

---

## 14. Documentation Requirements

- README.md with:
  - installation
  - examples
  - supported stacks
  - contribution guide

- Each adapter must be documented
- Breaking changes must be versioned (semver)

---

## 15. Versioning & Publishing

- Follow semantic versioning
- Initial release: `0.x`
- Public npm package
- No postinstall scripts

---

## 16. Acceptance Criteria

Scafix is considered complete when:

- A new stack can be added without touching core CLI logic
- Generated projects run immediately after creation
- CLI behaves predictably in both interactive and command modes
- Users can delete Scafix after scaffolding with no impact

---

## 17. Future Considerations (Non-Blocking)

- Plugin system
- Community adapters
- Config-based project generation
- Presets / profiles
