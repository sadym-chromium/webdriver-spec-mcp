import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWebDriverTools } from "./tools/webdriver.js";

async function main() {
  const server = new McpServer({
    name: "webdriver-spec-mcp",
    version: "1.0.0",
  });

  registerWebDriverTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebDriver Spec MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
