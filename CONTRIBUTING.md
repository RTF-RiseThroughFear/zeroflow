# Contributing to zeroflow

## Development

```bash
git clone https://github.com/RTF-RiseThroughFear/zeroflow.git
cd zeroflow
npm install
npm run dev      # Watch mode for library
npm run demo     # Run demo site
npm test         # Run tests
npm run typecheck # TypeScript validation
```

## Project structure

```
zeroflow/
  src/
    core/           # Measurement engine, stream buffer, provider
    hooks/          # React hooks (useStreamLayout, usePretextMeasure)
    components/     # React components (StreamMessage)
    types.ts        # Type definitions
    index.ts        # Public API
  demo/             # Vite demo site
  package.json
  tsup.config.ts    # Library build config
```

## Guidelines

1. No DOM reads in the rendering hot path. Use pretext for all measurement.
2. All exports must have JSDoc documentation.
3. Run `npm run typecheck` before submitting PRs.
4. Keep the bundle small. zeroflow + pretext should be under 10KB gzipped total.
