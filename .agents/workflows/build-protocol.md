---
description: Build protocol for zeroflow. Read before writing any code.
---

# zeroflow engineering workflow

## Before writing code

1. Read `AGENTS.md` for project context and architecture
2. Read `BUILD_PLAN.md` for the full implementation roadmap
3. Know where you are in the build sequence

## Code quality rules

### TypeScript
- Strict mode. No `any` types. No `@ts-ignore`.
- Run `npx tsc --noEmit` before every commit. Zero errors.
- All exports have JSDoc documentation.

### Testing
- Write failing test first, then make it pass.
- Test runner: Vitest
- Tests go in `src/__tests__/`
- Mock canvas for pretext tests (jsdom has no real canvas)
// turbo
- Run tests: `npm test`

### Performance
- ZERO DOM reads in the hot path. All measurement through pretext.
- The only acceptable DOM read is initial container width on mount.
- Profile with Chrome DevTools Performance tab.
- Target: 0 forced reflows during streaming.

### Bundle size
- Total bundle (zeroflow + pretext) must be under 10KB gzipped.
- No heavy dependencies. React is a peer dep.
- Check size: `npx bundlephobia zeroflow` after publish.

## Git workflow

// turbo-all
```bash
# Before starting work
git pull origin main

# After each feature
git add -A && git commit -m "feat: [description]"
git push origin main
```

## Build and verify

```bash
# Build the library
npm run build

# Type check
npm run typecheck

# Run tests
npm test

# Run demo
npm run demo
```

## Deployment

### npm publish
```bash
npm run build
npm publish
```

### Demo site (Vercel)
```bash
cd demo
npm run build
# Deploy via Vercel CLI or GitHub integration (free tier)
```
