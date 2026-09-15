# Command Code GOAT for OpenCode V2

A minimal OpenCode V2 plugin that registers Command Code, supports `/connect`,
and discovers the current model catalog once whenever OpenCode starts.

Claude models are intentionally excluded because they are not part of GOAT and
require a different API protocol.

## Install

Open the latest release on GitHub and replace `v.0.0.1` below with its tag:

```sh
opencode plugin add 'github:MatheusXCH/opencode-cmd-goat-provider#v.0.0.1'
```

Restart OpenCode, run `/connect`, select **Command Code GOAT**, and paste the API
key created in Command Code Studio. The key is stored by OpenCode, not by this
plugin.

The `CMD_API_KEY` environment variable is also supported.

## Update

Install the tag shown on the new GitHub release:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-cmd-goat-provider#v.0.0.1'
opencode plugin add 'github:MatheusXCH/opencode-cmd-goat-provider#NEW_TAG'
```

## Uninstall

Use the same release tag used during installation:

```sh
opencode plugin remove 'github:MatheusXCH/opencode-cmd-goat-provider#v.0.0.1'
```

## Development

```sh
npm install
npm run check
```
