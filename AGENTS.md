# searchx Agent Notes

- Use `rtk` before shell commands in this repo. See `@/Users/yingjie/.codex/RTK.md`.
- You may use `tmux`; use it for OAuth login flows, dev servers, or commands that can block.
- Keep commits atomic. Commit only files you touched and list each path explicitly.
- Prefix commit messages with Conventional Commit prefixes such as `feat:`, `fix:`, or `docs:`.
- Use `trash` instead of `rm` on macOS.
- Prefer British spelling when writing copy.
- When asked to make a PR, do not make it draft unless explicitly requested.

## Project Shape

- The repo is the source of truth.
- The user-facing command and skill name are `searchx`.
- The installed runtime is `~/.agents/tools/searchx/`.
- Agent-specific skills under `skills/` and in home-directory skill folders should stay thin pointers to the shared runtime.
- Do not move core OAuth or search logic into a single agent framework.

## Verification

- `node bin/searchx.js --help` should print usage.
- `node bin/searchx.js auth status` should run without throwing.
- `node scripts/xai-oauth.js --status` should run without throwing.
- `node scripts/xai-oauth.js --login` should reach the SpaceXAI device-code prompt.
- `node scripts/xai-search.js --help` should print usage.
- Live search requires a valid local OAuth token and an eligible SpaceXAI account.
