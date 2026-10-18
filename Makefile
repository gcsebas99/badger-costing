# Badger Grub Costeo — run everything from the repo root.
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Use the Node version from .nvmrc when nvm is available (system Node may be too old).
NVM_DIR ?= $(HOME)/.nvm
NODE := if [ -s "$(NVM_DIR)/nvm.sh" ]; then . "$(NVM_DIR)/nvm.sh" && nvm use --silent >/dev/null; fi;
API := cd backend && uv run
WEB := $(NODE) cd frontend && npm run -s

.PHONY: help install dev dev-api dev-web test test-api test-web lint format migrate migration types backup

help: ## Show available commands
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	cd backend && uv sync
	@echo "web: npm install" && $(NODE) cd frontend && npm install

dev: migrate ## Run API (:8000) and web (:5173) together
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) --no-print-directory dev-api & \
	$(MAKE) --no-print-directory dev-web & \
	wait

dev-api: ## Run only the API with reload
	$(API) uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

dev-web: ## Run only the Vite dev server
	@echo "web: npm run dev" && $(WEB) dev

test: test-api test-web ## Run all checks and tests

test-api: ## Ruff + pytest
	$(API) ruff check .
	$(API) ruff format --check .
	$(API) pytest -q

test-web: ## Typecheck + lint + vitest
	@echo "web: npm run typecheck" && $(WEB) typecheck
	@echo "web: npm run lint" && $(WEB) lint
	@echo "web: npm run test" && $(WEB) test

lint: ## Lint backend and frontend
	$(API) ruff check .
	@echo "web: npm run lint" && $(WEB) lint

format: ## Auto-format backend code
	$(API) ruff check --fix .
	$(API) ruff format .

migrate: ## Apply DB migrations
	$(API) alembic upgrade head

migration: ## Create a migration: make migration m="add supply"
	@test -n "$(m)" || (echo 'Usage: make migration m="message"' && exit 1)
	$(API) alembic revision --autogenerate -m "$(m)"

types: ## Regenerate frontend API types from the backend OpenAPI schema
	$(API) python -m scripts.export_openapi ../frontend/src/api/openapi.json
	@echo "web: npm run types" && $(WEB) types

backup: ## Timestamped DB copy into data/backups (override with BACKUP_DIR=/path)
	$(API) python -m scripts.backup "$(BACKUP_DIR)"
