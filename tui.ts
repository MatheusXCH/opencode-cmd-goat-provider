import { Plugin } from "@opencode/plugin/tui"
import { GoatUsage } from "./rpc.js"

export default Plugin.define({
  id: "command-code.goat.tui",
  setup(context) {
    const usage = context.client.rpc(GoatUsage)
    context.ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "command-code.goat.usage",
            title: "Command Code GOAT usage",
            description: "Show 5-hour, weekly, and monthly usage",
            group: "Command Code",
            palette: true,
            slash: { name: "goat-usage" },
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
