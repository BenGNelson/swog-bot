.PHONY: dev up down logs register register-clear test typecheck check-secrets deploy help

dev: ## Run the bot locally with hot reload (uses your DEV token)
	docker compose --profile dev up --build

up: ## Run the bot locally in the background (prod-style)
	docker compose up --build -d

down: ## Stop it
	docker compose --profile dev down

logs: ## Follow the local bot's logs
	docker compose logs -f

register: ## Push slash commands to Discord (guild if DISCORD_GUILD_ID is set, else global)
	docker compose run --rm --no-deps bot node scripts/register.ts

register-clear: ## Remove all registered slash commands
	docker compose run --rm --no-deps bot node scripts/register.ts --clear

test: ## Typecheck + unit tests + docker build + secret scan
	@./scripts/test.sh

typecheck: ## Typecheck only (load-bearing: Node strips types without checking them)
	@docker run --rm -v "$(PWD)":/app -w /app node:24-alpine npx tsc --noEmit

check-secrets: ## Fail if a secret or personal identifier would be committed
	@./scripts/check-secrets.sh

deploy: ## Deploy to the server (runs the full test suite first)
	@./scripts/test.sh && ./scripts/deploy.sh

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
