# Crazy Game Backend

Authoritative Express + Socket.IO + Redis backend for the Crazy multiplayer card game.

See the root [README.md](../README.md) and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for complete setup, security architecture, and Socket.IO event documentation.

## Commands

```bash
npm install
npm run lint     # ESLint v9 + typescript-eslint
npm run build    # Compile TypeScript (backend + shared contracts)
NODE_ENV=test npm test
npm run dev      # Watch mode development server
```
