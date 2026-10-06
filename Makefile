.DEFAULT_GOAL := help
.PHONY: help install dev build build-dev preview lint typecheck check audit clean distclean

NPM ?= npm

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies from package-lock.json
	$(NPM) ci

dev: ## Start the dev server (http://localhost:8080)
	$(NPM) run dev

build: ## Create a production build in dist/
	$(NPM) run build

build-dev: ## Create a development build in dist/
	$(NPM) run build:dev

preview: build ## Serve the production build locally
	$(NPM) run preview

lint: ## Run ESLint
	$(NPM) run lint

typecheck: ## Run the TypeScript compiler without emitting files
	npx tsc -p tsconfig.app.json --noEmit

check: lint typecheck build ## Run lint, typecheck and build (use before a PR)

audit: ## Check production dependencies for known vulnerabilities
	$(NPM) audit --omit=dev

clean: ## Remove build output
	rm -rf dist dist-ssr

distclean: clean ## Remove build output and node_modules
	rm -rf node_modules
