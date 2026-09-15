# Backlog

The plugin stays intentionally small: one catalog fetch at startup, native
OpenCode credentials, and the OpenAI-compatible Command Code provider.

## Priority order

1. Visual usage view — item 7.
2. Reasoning effort — item 8.
3. Model outside the GOAT plan — item 5.
4. Graceful catalog discovery failure — item 2.
5. Focused tests — item 1.

## 1. Visual usage view — item 7

Status: approved for implementation; upstream API is alpha.

The installed Command Code CLI uses these authenticated endpoints for
`/usage`, and all three returned HTTP 200 with the existing Provider API key:

- `GET https://api.commandcode.ai/alpha/billing/credits`
  - monthly, purchased, and free credit balances;
  - five-hour `used`, `cap`, and `resetAt`;
  - weekly `used`, `cap`, and `resetAt`;
  - current limited state.
- `GET https://api.commandcode.ai/alpha/billing/subscriptions`
  - plan ID, status, and current billing-period boundaries.
- `GET https://api.commandcode.ai/alpha/usage/summary`
  - total cost, credits, tokens, request counts, and success rate.

These `/alpha` routes are used by the official CLI but are not documented as
part of the public Command Code Provider API. They may therefore change without
notice.

Proposed experience:

- Add a TUI slash command such as `/goat-usage`.
- Show three integrated meters: 5 hours, week, and month.
- Include exact reset timestamps/countdowns where returned by the API.
- Clearly distinguish subscription credits from purchased/free credits.
- Show an explicit unavailable state instead of estimating values locally.

Proposed architecture:

- The server plugin resolves the active `command-code` credential through the
  OpenCode credential store and calls the three endpoints.
- A small OpenCode TUI entrypoint requests the normalized result through plugin
  RPC and renders the view.
- Never expose the API key to the TUI, logs, plugin storage, or error messages.
- Fetch only when the user opens the usage view; do not poll in the background.

Release conditions:

- Treat the integration as best-effort and label the upstream API as alpha.
- Isolate response parsing so an upstream schema change produces an
  `Unavailable` view rather than breaking the provider.
- Add fixtures for every response shape used by the UI.

## 2. Reasoning effort — item 8

Status: approved for implementation.

Observed Provider API contract:

- The OpenAI-compatible request field is `reasoning_effort`.
- Accepted values are `low`, `medium`, `high`, `xhigh`, and `max`.
- A live request using `gpt-5.6-luna` with `low` succeeded.
- An invalid value was rejected with HTTP 400 and the accepted enum.
- `/provider/v1/models` does not currently publish the supported effort levels
  per model.

Implementation direction:

- Expose OpenCode model variants that send `reasoning_effort` in the request
  body.
- Determine a conservative policy for models that support only a subset of the
  five levels.
- Keep discovery dynamic; do not replace it with a static model catalog.
- Add non-paid tests for variant registration and request-body mapping.
- Use optional, explicit live tests only for representative GOAT model
  families.

## 3. Model outside the GOAT plan — item 5

Status: approved.

- Recognize the official `MODEL_NOT_IN_PLAN` Provider API error.
- Explain that the model exists in the global Command Code catalog but is not
  available to the connected GOAT account.
- Do not maintain a static GOAT allowlist.

## 4. Graceful catalog discovery failure — item 2

Status: approved.

- Do not prevent OpenCode from starting when model discovery fails.
- Emit one concise, actionable error.
- Leave the provider without discovered models for that startup.
- Retry only on the next OpenCode startup; do not add timers, persistent cache,
  or background retries.

## 5. Focused tests — item 1

Status: approved.

- Test parsing of the live `/provider/v1/models` response shape.
- Test exclusion of `claude-*` and `anthropic/*` model IDs.
- Test registration of the provider and `/connect` API-key method.
- Test model IDs containing `/` and `:`.
- Test invalid and empty catalogs without making paid API requests.

Tests run in the Release workflow. Push/PR CI will not be added.

## Deferred

### Enforced zero data retention (ZDR) — item 4

Status: understood and deferred.

If implemented later, an opt-in setting will add `x-cmd-zdr: 1`. It must remain
disabled by default because enforced ZDR can change routing/cost and can reject
a model when no ZDR-capable upstream is available.

### Push/PR CI — item 3

Status: rejected.

Tests continue to run in the Release workflow only.

## Versioning

- Keep the existing `v.0.0.1` release as historical.
- Use conventional SemVer tags from the next release onward: `v0.0.2`,
  `v0.1.0`, and eventually `v1.0.0`.
