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
        "outputTokens": 32000
      }
    }
  ]
}
```

`refreshMs` has a minimum of 10 seconds. The model endpoint currently exposes
context size but not a separate maximum-output value, so `outputTokens` is a
conservative local fallback capped by the reported context size.

## Development

```sh
npm run check
```

The package is pinned to `@opencode/plugin` 2.0.3 so type checking catches
incompatible plugin API changes.

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

## Official references

- [OpenCode 2 plugin API](https://opencode.ai/v2/docs/build/plugins)
- [OpenCode 2 providers](https://opencode.ai/v2/docs/providers)
- [Command Code Provider API announcement](https://commandcode.ai/blog/command-code-provider-api)
- [Command Code GOAT plan](https://commandcode.ai/docs/plans/goat)

## License

MIT
