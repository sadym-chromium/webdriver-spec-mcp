import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWebDriverTools } from "./src/tools/webdriver.js";

async function main() {
  const server = new McpServer({
    name: "test-server",
    version: "1.0.0",
  });

  registerWebDriverTools(server);

  // We need to access the tool handler. The SDK doesn't expose it directly in a nice way for testing
  // without connecting a transport, but we can access the internal tool map if we are tricky,
  // OR we can just use the server's callTool method if it exists, or mimicking a request.
  // Actually, McpServer abstracts this.
  
  // Let's look at McpServer definition or just try to find the tool in the server._tools (private)
  // or similar.
  // Alternatively, since I have the code, I can just copy the logic for a quick test.
  // But using the registered tool is better integration test.
  
  // Since McpServer doesn't easily let us "call" a tool locally without a client/transport loop,
  // I will just import the dependencies and run the logic manually for this test script.
  // This is easier than setting up a full MCP client-server pair.
  
  // Actually, wait. I can use the tool logic directly if I extract it?
  // No, it's inside a closure in registerWebDriverTools.
  
  // Better idea: Create a dummy transport that intercepts the message? Too complex.
  
  // I will just modify `test-mcp.ts` to include the generation part.
  
  const { Embedder } = await import("./src/lib/embedder.js");
  const { Store } = await import("./src/lib/store.js");
  const { generateResponse } = await import("./src/lib/gemini.js");

  const question = "How do I subscribe to log events in BiDi?";
  console.log(`Question: ${question}`);

  const store = new Store();
  const embedder = Embedder.getInstance();
  const vector = await embedder.embed(question);
  const results = await store.search(vector, 3);

  console.log("Found context:");
  results.forEach(r => console.log(`- ${r.title}`));

  const context = results.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
  
  const prompt = `You are an expert on WebDriver BiDi and Classic specifications. Answer the following question based ONLY on the provided context.
  
  Context:
  ${context}
  
  Question: ${question}
  
  Answer:`;

  console.log("Generating response...");
  const answer = await generateResponse(prompt);
  console.log("\nGenerated Answer:\n", answer);
}

main().catch(console.error);
