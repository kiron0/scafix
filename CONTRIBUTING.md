# Contributing to Scafix

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
npm install
npm run build
```

## Running Tests

```bash
npm run test          # unit tests
npm run test:smoke    # network smoke tests (downloads real CLIs)
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
```

## Adding a New Stack Adapter

1. Create `src/adapters/<stack>.adapter.ts` implementing the `StackAdapter` interface.
2. Add a customization interface and prompt function in `src/prompts/customizations.ts`.
3. Register the adapter in `src/adapters/index.ts`.
4. Add unit tests in `tests/adapters/<stack>.adapter.test.ts`.
5. Update the registry test count in `tests/adapters/registry.test.ts`.
6. Add a card entry in `docs/components/stacks-section.tsx`.

## Code Style

- Run `npm run format` before committing.
- Follow existing patterns for adapter structure (validate, prompt, exec, reconcile).
- Use the shared scaffold helpers in `src/adapters/shared/scaffold.ts`.

## Pull Requests

- Keep PRs focused on a single change.
- Include tests for new functionality.
- Ensure `npm run lint && npm run typecheck && npm run test` passes.
