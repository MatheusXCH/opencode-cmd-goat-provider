# Command Code GOAT for OpenCode V2

A minimal OpenCode V2 plugin that registers Command Code, supports `/connect`,
discovers the current model catalog whenever OpenCode starts, shows GOAT usage,
and exposes reasoning-effort controls.

Claude models are intentionally excluded because they are not part of GOAT and
require a different API protocol.

## Install

Install the current release:

```sh
opencode plugin add 'github:MatheusXCH/opencode-cmd-goat-provider#v0.0.3'
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

## Update

Install the tag shown on the new GitHub release:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-cmd-goat-provider#OLD_TAG'
opencode plugin add 'github:MatheusXCH/opencode-cmd-goat-provider#v0.0.3'
```

## Uninstall

Use the same release tag used during installation:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-cmd-goat-provider#v0.0.3'
```

## Compatibility

The plugin targets OpenCode V2 (`@opencode/plugin >=2.0.3 <3`). Its optional
TUI peer ranges allow the host OpenCode installation to provide matching
OpenTUI, theme, and Solid versions, avoiding duplicate UI runtimes.

## Development

```sh
npm install
npm run check
```
