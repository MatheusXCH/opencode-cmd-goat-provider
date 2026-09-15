import { Plugin } from "@opencode/plugin/tui"
import { CMD_USAGE_COMMAND, CommandCodeUsage } from "./rpc.js"

export default Plugin.define({
  id: "command-code.provider.tui",
  setup(context) {
    const usage = context.client.rpc(CommandCodeUsage)
    context.ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "command-code.provider.usage",
            title: "Command Code usage",
            description: "Show 5-hour, weekly, and monthly usage",
            group: "Command Code",
            palette: true,
            slash: { name: CMD_USAGE_COMMAND },
            async run() {
              try {
                const result = await usage.get({})
                const message = typeof result === "object" && result !== null && "message" in result
                  ? String(result.message)
                  : "Usage is unavailable."
                await context.ui.dialog.alert({ title: "Command Code usage", message })
              } catch {
                await context.ui.dialog.alert({
                  title: "Command Code usage",
                  message: "Usage is unavailable. Check your Command Code connection and try again.",
                })
              }
            },
          }],
        }))
        return null
      },
    })
  },
})
