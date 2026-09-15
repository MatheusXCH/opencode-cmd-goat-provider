import { Rpc } from "@opencode/plugin/rpc"

export const CMD_USAGE_COMMAND = "cmd-usage"

export const CommandCodeUsage = Rpc.define({
  id: "command-code.provider.usage",
  methods: {
    get: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})
