# Backlog

The plugin stays intentionally small: one catalog fetch at startup, native
OpenCode credentials, and the OpenAI-compatible Command Code provider.

## Next release

### Generic Command Code plan support — v0.1.0

Status: approved and planned as one release item.

Scope: support GOAT, Pro, Max 10x, and Max 20x through the shared Command Code
Provider API. The Go plan and Claude models remain explicitly unsupported.

1. Neutral product experience
   - Rename visible `Command Code GOAT` labels to `Command Code`.
   - Replace `/goat-usage` with `/cmd-usage`.
   - Rename GOAT-specific server, TUI, RPC, command, symbol, and diagnostic IDs
     consistently while preserving the credential integration ID
     `command-code` and `CMD_API_KEY`.
2. Plan-neutral errors
   - Keep recognizing `MODEL_NOT_IN_PLAN` without a static allowlist.
   - Refer to the connected Command Code plan rather than GOAT specifically.
3. Pro and Max usage rendering
   - Continue reading 5-hour, weekly, monthly, purchased, and free balances
     from the API rather than hardcoding plan limits.
   - Normalize any standard and premium pool fields returned for Max and render
     them separately when present.
   - Never estimate a missing pool; show it as unavailable when the alpha API
     does not expose enough information.
4. Dynamic plan identity
   - Format GOAT, Pro, Max 10x, and Max 20x plan IDs returned by the subscription
     endpoint.
   - Display an unknown returned plan safely instead of defaulting to GOAT.
5. Fixtures and automated coverage
   - Add GOAT, Pro, Max 10x, Max 20x, unknown-plan, missing-field, and malformed
     usage fixtures.
   - Cover generic labels and IDs, `/cmd-usage`, plan-neutral errors, Claude
     exclusion, and both single-pool and multi-pool rendering.
   - Keep tests in the Release workflow only.
6. Validation boundary
   - Run live discovery, usage, reasoning-effort, and model-generation checks
     with the available GOAT credential without reading or logging its value.
   - Validate Pro and Max behavior with contract tests and documented limits;
     do not claim live Pro/Max validation because no such credentials are
     available.
   - Treat the undocumented `/alpha` usage schema as best-effort and isolate
     parsing so schema drift cannot break provider startup or model calls.
7. Documentation
   - Document GOAT, Pro, Max 10x, and Max 20x support, with Go and Claude called
     out as unsupported.
   - Document dynamic catalog behavior, plan entitlements, `/cmd-usage`, and
     the `latest` install/update/uninstall flow.
8. Project rename
   - Rename the GitHub repository, local folder, and package metadata to
     `opencode-command-code-provider`.
   - Update every repository URL, README command, lockfile package name, and
     installed OpenCode plugin target.
   - Move the lowercase `latest` tag with the renamed repository and keep the
     release workflow updating it for future `v*` releases.
   - Preserve versioned tags and GitHub's old-repository redirect for existing
     links, then validate clean install, update, removal, service restart, and
     plugin discovery through the new URL.

Release gate: version `0.1.0`, tag `v0.1.0`, passing type-check/tests, successful
GitHub Release workflow, clean installation through the renamed repository's
`latest` tag, and direct OpenCode validation with the available GOAT account.

## Completed

All previously approved items are implemented as of v0.0.4.

## 1. Visual usage view — item 7

Status: implemented in v0.0.2; upstream API is alpha.

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

Implemented experience:

- Add the TUI slash command `/goat-usage`.
- Show three integrated meters: 5 hours, week, and month.
- Include exact reset timestamps/countdowns where returned by the API.
- Clearly distinguish subscription credits from purchased/free credits.
- Show an explicit unavailable state instead of estimating values locally.

Implemented architecture:

- The server plugin resolves the active `command-code` credential through the
  OpenCode credential store and calls the three endpoints.
- A small OpenCode TUI entrypoint requests the normalized result through plugin
  RPC and renders the view.
- Never expose the API key to the TUI, logs, plugin storage, or error messages.
- Fetch only when the user opens the usage view; do not poll in the background.

Ongoing safeguards:

- Treat the integration as best-effort and label the upstream API as alpha.
- Isolate response parsing so an upstream schema change produces an
  `Unavailable` view rather than breaking the provider.
- Add fixtures for every response shape used by the UI.

## 2. Reasoning effort — item 8

Status: implemented in v0.0.2.

Observed Provider API contract:

- The OpenAI-compatible request field is `reasoning_effort`.
- Accepted values are `low`, `medium`, `high`, `xhigh`, and `max`.
- A live request using `gpt-5.6-luna` with `low` succeeded.
- An invalid value was rejected with HTTP 400 and the accepted enum.
- `/provider/v1/models` does not currently publish the supported effort levels
  per model.

Implementation:

- Expose OpenCode model variants that send `reasoning_effort` in the request
  body.
- Expose all five API-supported levels because model discovery does not publish
  per-model restrictions; a provider-side rejection remains visible to users.
- Keep discovery dynamic; do not replace it with a static model catalog.
- Add non-paid tests for variant registration and request-body mapping.
- Use optional, explicit live tests only for representative GOAT model
  families.

## 3. Model outside the GOAT plan — item 5

Status: implemented in v0.0.4.

- Recognize the official `MODEL_NOT_IN_PLAN` Provider API error.
- Explain that the model exists in the global Command Code catalog but is not
  available to the connected GOAT account.
- Do not maintain a static GOAT allowlist.

## 4. Graceful catalog discovery failure — item 2

Status: implemented in v0.0.4.

- Do not prevent OpenCode from starting when model discovery fails.
- Emit one concise, actionable error.
- Leave the provider without discovered models for that startup.
- Retry only on the next OpenCode startup; do not add timers, persistent cache,
  or background retries.

## 5. Focused tests — item 1

Status: implemented in v0.0.4.

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
