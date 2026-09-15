# Command Code Provider for OpenCode V2

A minimal OpenCode V2 plugin that registers Command Code, supports `/connect`,
discovers the current model catalog whenever OpenCode starts, shows plan usage,
and exposes reasoning-effort controls.

GOAT, Pro, Max 10×, and Max 20× are supported through the shared Provider API.
The Go plan has no Provider API access, and Claude models are intentionally
excluded because they require a different protocol.

## Install

Install the recommended moving tag, which always points to the newest tested
release:

```sh
opencode plugin add 'github:MatheusXCH/opencode-command-code-provider#latest'
```

Restart OpenCode, run `/connect`, select **Command Code**, and paste the API
key created in Command Code Studio. The key is stored by OpenCode, not by this
plugin.

The `CMD_API_KEY` environment variable is also supported.

## Usage and reasoning effort

Run `/cmd-usage` in the TUI to see the current 5-hour, weekly, and monthly
allowances and their reset countdowns. This view is fetched on demand from the
alpha usage API; the credential stays in the OpenCode server.

Every discovered model offers `low`, `medium`, `high`, `xhigh`, and `max`
variants. Select the desired variant in OpenCode to send its corresponding
`reasoning_effort` value to Command Code.

If the global catalog contains a model that is not included in the connected
plan, the plugin turns `MODEL_NOT_IN_PLAN` into an actionable
message without maintaining a static allowlist.

Model discovery is best-effort. If the catalog is temporarily unavailable,
OpenCode still starts and the plugin retries automatically on the next startup.

## Update

Update the installed `latest` tag through OpenCode:

```sh
opencode plugin update 'github:MatheusXCH/opencode-command-code-provider#latest'
```

Versioned tags such as `v0.1.0` remain available when a pinned installation or
rollback is preferred.

## Uninstall

Remove the same target used during installation:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-command-code-provider#latest'
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
