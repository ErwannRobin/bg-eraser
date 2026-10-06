# Contributing to BG Eraser

Thanks for your interest in contributing! Bug reports, ideas and pull requests are welcome.

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Your contributions are released under the [MIT License](LICENSE).

## Report a bug or suggest a feature

- Search the [existing issues](https://github.com/ErwannRobin/bg-eraser/issues) first.
- Open a new issue with the template. For bugs, include your browser, OS and whether WebGPU is available.
- For security problems, do **not** open a public issue. See [SECURITY.md](SECURITY.md).

## Set up the project

You need Node.js 18 or newer and npm.

```sh
git clone https://github.com/ErwannRobin/bg-eraser.git
cd bg-eraser
make install
make dev        # http://localhost:8080
```

Run `make help` to see all targets.

## Make a change

1. Fork the repo and create a branch from `main` (for example `fix/crop-ratio`).
2. Keep the change small and focused. One topic per pull request.
3. Follow the style of the surrounding code (TypeScript, React function components, Tailwind).
4. Run `make check` (lint, typecheck, build). It must pass before you open the PR.
5. Open a pull request and fill in the template. Add a screenshot or GIF for UI changes.

## Notes

- Images must stay on the user's device. Please do not add code that uploads user images or adds tracking.
- Files in `src/components/ui/` come from [shadcn/ui](https://ui.shadcn.com/). Prefer to change the app components instead.
- Use `npm` for dependencies and commit `package-lock.json`. Do not add other lockfiles.
