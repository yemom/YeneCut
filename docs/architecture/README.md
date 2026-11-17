# Architecture

YeneCut AI is a local-first monorepo. The Premiere UXP plugin (TypeScript/React) communicates
with a Python FastAPI engine over authenticated localhost HTTP. Premiere API calls are isolated
in `apps/premiere-plugin/src/premiere`. AI processing is isolated in `apps/ai-engine`.

Cloud features are optional and are not required for local editing.
