# Command Code GOAT provider for OpenCode 2

An OpenCode 2 plugin that connects the official Command Code Provider API to
OpenCode's provider and model catalog.

The plugin:

- registers `command-code` as an OpenCode provider;
- uses OpenCode's own credential store or the `CMD_API_KEY` environment variable;
- discovers models from the live `/provider/v1/models` endpoint;
- refreshes the catalog without writing a static model list;
- routes Claude models through Anthropic Messages and all other models through
  OpenAI Chat Completions;
- keeps the last successful catalog if a refresh fails.
- translates documented Provider API failures into actionable diagnostics;
- emits structured, secret-free operational events for catalog and request
  failures.

It does not read Command Code CLI files, scrape tokens, call private endpoints,
or claim to report the global GOAT quota.

## Requirements

- OpenCode `2.0.3`
- Node.js 22 or a compatible OpenCode plugin runtime
- A Command Code plan with Provider API access and an API key created in Studio

## Local installation

Install dependencies in this repository:

```sh
npm install
```

Add the local plugin to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-cmd-goat-provider"
  ]
}
```

Start OpenCode, run `/connect`, choose **Command Code**, and enter the API key.
Alternatively, start the OpenCode server with `CMD_API_KEY` set. Then use
`/models` and select a model under `command-code`.

Do not put the API key in `opencode.jsonc` or commit it to this repository.

## Options

Options are optional and intended mainly for testing or self-hosted proxies:

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-cmd-goat-provider",
      "options": {
        "baseURL": "https://api.commandcode.ai/provider/v1",
        "refreshMs": 300000,
        "timeoutMs": 15000,
        "outputTokens": 32000,
        "toolModels": ["exact/model-id-confirmed-with-tools"]
      }
    }
  ]
}
```

`refreshMs` has a minimum of 10 seconds. The model endpoint currently exposes
context size but not a separate maximum-output value, so `outputTokens` is a
conservative local fallback capped by the reported context size.

The public catalog does not publish tool support. For safety, models therefore
default to `capabilities.tools = false`. Add exact, verified model IDs to
`toolModels` to enable agent tools for them. `"toolModels": "all"` is available
as an explicit opt-in for accounts whose entire accessible catalog has been
verified; it is not recommended for an unknown or changing inventory.

## Development

```sh
npm run check
```

The package is pinned to `@opencode/plugin` 2.0.3 so type checking catches
incompatible plugin API changes.

Protocol tests use a local SSE server and never consume credits. They exercise
incremental text, final usage and finish reasons, fragmented tool calls,
malformed arguments, cancellation, and both OpenAI-compatible and Anthropic
Messages routing. Real Provider API checks are separate and opt-in:

```sh
CMD_LIVE=1 CMD_API_KEY=... CMD_LIVE_MODEL=... npm run test:live
```

That check performs a harmless model → `lookup` tool → model round trip. To
also test Claude Messages, set `CMD_LIVE_ANTHROPIC_MODEL`; it is skipped with an
explanation otherwise because Claude needs an eligible plan or extra credits.
`CMD_BASE_URL` may override the official endpoint for a compatible proxy.

## Errors, retries, and operational logs

The plugin classifies the documented Command Code errors for unsupported
models, invalid requests, authentication, permission, plan upgrades, unavailable
ZDR routes, rate limits, and server failures. In particular,
`MODEL_NOT_IN_PLAN` explains that the catalog is global and does not claim that
the selected model belongs to GOAT. Unknown provider failures keep their
provider message and remain classified as unknown.

OpenCode 2.0.3 owns request retries. Its native policy retries rate limits,
provider `5xx` responses, and pre-delivery transport failures with bounded
exponential backoff; it honors `Retry-After` (capped by OpenCode) and stops after
four retries. The plugin does not replace that policy. It adds a conservative
guard so HTTP `400`, `401`, `403`, and `422` fail immediately.

Operational messages are JSON records prefixed with `[command-code]`. They only
contain event names, status/category, model count, timestamps, and whether a
failure is retryable. Request/response bodies, URLs, authentication headers,
and credentials are never logged. Relevant events are:

- `catalog_refresh_succeeded` with the model count and successful refresh time;
- `catalog_refresh_failed`, distinguishing initial and background discovery and
  reporting how many last-known models were retained;
- `provider_request_failed` with HTTP status and sanitized error category.

OpenCode 2.0.3 has no dedicated provider-health panel exposed to plugins, so
these structured logs are the native diagnostic surface for now. A missing
credential is shown by OpenCode's connection flow; HTTP authentication failures,
catalog availability, and out-of-plan models are reported separately. These
events are operational health signals, never GOAT quota statistics.

## Current limitations

- The public model inventory does not currently advertise tool, image, output
  limit, pricing, or plan-entitlement metadata. Discovered entries therefore
  use documented conservative defaults where OpenCode requires values.
- The live inventory is global, not account-specific: authenticated and
  anonymous requests currently return the same catalog. It can therefore list
  premium models that a GOAT account cannot invoke; the API reports
  `MODEL_NOT_IN_PLAN` when one is selected. The plugin does not maintain a
  fragile static GOAT allowlist.
- No documented Provider API endpoint for global GOAT quota is used. OpenCode's
  own session statistics remain local observations, not authoritative account
  quota.
- Protocol selection is derived from the model identifier because the live
  model response does not expose an explicit protocol field.
- Invalid streamed JSON tool arguments are surfaced by OpenCode 2.0.3 as an
  empty input object. Tool schemas must therefore keep required fields and
  validation strict; the integration tests verify that only one call is
  reconstructed for OpenCode's tool validation/execution layer.

## Official references

- [OpenCode 2 plugin API](https://opencode.ai/v2/docs/build/plugins)
- [OpenCode 2 providers](https://opencode.ai/v2/docs/providers)
- [Command Code Provider API announcement](https://commandcode.ai/blog/command-code-provider-api)
- [Command Code GOAT plan](https://commandcode.ai/docs/plans/goat)

## License

MIT
