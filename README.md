# Command Code GOAT for OpenCode V2

A minimal OpenCode V2 plugin that registers Command Code, supports `/connect`,
discovers the current model catalog whenever OpenCode starts, shows GOAT usage,
and exposes reasoning-effort controls.

Claude models are intentionally excluded because they are not part of GOAT and
require a different API protocol.

## Install

Install the recommended moving tag, which always points to the newest tested
release:

```sh
opencode plugin add 'github:MatheusXCH/opencode-cmd-goat-provider#latest'
```

Restart OpenCode, run `/connect`, select **Command Code GOAT**, and paste the API
key created in Command Code Studio. The key is stored by OpenCode, not by this
plugin.

The `CMD_API_KEY` environment variable is also supported.

## Usage and reasoning effort

Run `/goat-usage` in the TUI to see the current 5-hour, weekly, and monthly
allowances and their reset countdowns. This view is fetched on demand from the
alpha usage API; the credential stays in the OpenCode server.

Every discovered model offers `low`, `medium`, `high`, `xhigh`, and `max`
variants. Select the desired variant in OpenCode to send its corresponding
`reasoning_effort` value to Command Code.

If the global catalog contains a model that is not included in the connected
GOAT subscription, the plugin turns `MODEL_NOT_IN_PLAN` into an actionable
message without maintaining a static allowlist.

Model discovery is best-effort. If the catalog is temporarily unavailable,
OpenCode still starts and the plugin retries automatically on the next startup.

## Update

Update the installed `latest` tag through OpenCode:

```sh
opencode plugin update 'github:MatheusXCH/opencode-cmd-goat-provider#latest'
```

Versioned tags such as `v0.0.4` remain available when a pinned installation or
rollback is preferred.

## Uninstall

Remove the same target used during installation:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-cmd-goat-provider#latest'
```

## Compatibility

The plugin targets OpenCode V2 (`@opencode/plugin >=2.0.3 <3`). Its optional
TUI peer ranges allow the host OpenCode installation to provide matching
OpenTUI, theme, and Solid versions, avoiding duplicate UI runtimes.

## Development

```sh
npm install
npm run check
npm test
```
