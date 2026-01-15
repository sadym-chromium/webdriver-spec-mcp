import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Embedder } from "../lib/embedder.js";
import { Store } from "../lib/store.js";
import { generateResponse } from "../lib/gemini.js";

export function registerWebDriverTools(server: McpServer) {
  server.registerTool(
    "search_specs",
    {
      description: "Search the WebDriver BiDi and Classic specifications for relevant sections.",
      inputSchema: {
        query: z.string().describe("The search query (e.g., 'how to create a session', 'browsing context', 'navigation')."),
      },
    },
    async ({ query }) => {
      const store = new Store();
      const embedder = Embedder.getInstance();
      const vector = await embedder.embed(query);
      const results = await store.search(vector);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content.substring(0, 500) + "...", // Truncate content for preview
              spec: r.spec
            })), null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "read_spec_section",
    {
        description: "Read the full content of a specific section from the WebDriver specs.",
        inputSchema: {
            url: z.string().describe("The URL of the section to read (returned by search_specs)."),
        }
    },
    async ({ url }) => {
        const store = new Store();
        const section = await store.getByUrl(url);
        
        if (!section) {
            return {
                content: [{ type: "text", text: `Section not found for URL: ${url}` }],
                isError: true
            }
        }

        return {
            content: [{ type: "text", text: `# ${section.title}\n\n${section.content}` }]
        }
    }
  );

  server.registerTool(
    "ask_webdriver",
    {
      description: "Ask a question about WebDriver specs and get a generated answer based on the documentation.",
      inputSchema: {
        question: z.string().describe("The question to ask."),
      },
    },
    async ({ question }) => {
      const store = new Store();
      const embedder = Embedder.getInstance();
      const vector = await embedder.embed(question);
      const results = await store.search(vector, 3); // Get top 3 results

      const context = results.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
      
      const prompt = `You are an expert on WebDriver BiDi and Classic specifications. Answer the following question based ONLY on the provided context.      
Context:
${context}

Question: ${question}

Answer:`

      const answer = await generateResponse(prompt);

      return {
        content: [
          {
            type: "text",
            text: answer,
          },
        ],
      };
    }
  );
}