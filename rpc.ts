import { Rpc } from "@opencode/plugin/rpc"

export const GoatUsage = Rpc.define({
  id: "command-code.goat.usage",
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
