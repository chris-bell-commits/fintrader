# FinTrader E2E Tests

Playwright end-to-end tests that run against the full Docker container with
`LLM_MOCK=true`.

## Run

```bash
# From the project root. -v gives a fresh seeded DB (required: fresh_start
# asserts the £10,000 starting balance, which trades in other specs would spend).
docker compose -f test/docker-compose.test.yml down -v
docker compose -f test/docker-compose.test.yml up -d --build

# Wait for health, then run the suite
cd test
npm ci
npx playwright install chromium
npx playwright test

# Teardown
docker compose -f test/docker-compose.test.yml down -v
```

Tests run serially (single worker) against the shared container.
