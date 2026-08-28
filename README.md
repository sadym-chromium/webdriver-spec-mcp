# WebDriver Spec MCP Server

This is a Model Context Protocol (MCP) server that provides access to the WebDriver BiDi and Classic specifications. It is designed for **Jetski** and other MCP clients to search and read authoritative sections from the WebDriver specs.

## Features

- **Ingest WebDriver Specs**: Fetches and parses the latest WebDriver BiDi and Classic specifications from W3C.
- **Semantic Search**: Search for relevant sections in the specs using natural language queries (`search_specs`) powered by local vector embeddings.
- **Read Specs**: Retrieve the full content of specific sections (`read_spec_section`).
- **Vector Storage**: Uses [LanceDB](https://lancedb.com/) for efficient local vector storage.
- **Local Embeddings**: Embeddings run locally on CPU via `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`), requiring no external API keys for core operations.

## Tools

The server exposes the following tools:

- `search_specs`: Search the WebDriver BiDi and Classic specifications for relevant sections.
  - Arguments: `query` (string)
- `read_spec_section`: Read the full content of a specific section.
  - Arguments: `url` (string)
- `ask_webdriver`: Ask a question about WebDriver specs.
  - Arguments: `question` (string)

## Installation

1.  **Clone the repository.**

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Ingest data:**

    Before using the server, ingest the WebDriver specifications into the local vector store. This script fetches the specs, generates embeddings, and stores them in `.mcp-data`.

    ```bash
    npm run ingest
    ```

4.  **Build the project:**

    Compile the TypeScript code:

    ```bash
    npm run build
    ```

5.  **Run tests:**

    Verify stdio communication, tool listing, and vector querying:

    ```bash
    npm test
    ```

6.  **Configure MCP Client:**

    For **Jetski CLI**, add the server configuration to your dedicated MCP configuration file at **`~/.gemini/jetski/mcp_config.json`** (or globally at `~/.gemini/config/mcp_config.json`).

    Make sure to replace `<PATH_TO_REPO>` with the absolute path to this repository:

    ```json
    {
      "mcpServers": {
        "webdriver-spec": {
          "command": "node",
          "args": [
            "<PATH_TO_REPO>/build/src/index.js"
          ]
        }
      }
    }
    ```

    For other clients like Claude Desktop (`claude_desktop_config.json`), place the `"webdriver-spec"` configuration object inside `"mcpServers"`.

## Architecture

- **`src/index.ts`**: Main entrypoint setting up the MCP server over stdio.
- **`src/tools/webdriver.ts`**: Defines the MCP tools (`search_specs`, `read_spec_section`, `ask_webdriver`).
- **`src/lib/store.ts`**: Handles vector search and document lookup with LanceDB.
- **`src/lib/embedder.ts`**: Generates text embeddings using local transformer models.
- **`scripts/ingest-specs.ts`**: Fetches HTML from W3C, parses sections with `jsdom`, generates embeddings, and indexes them into LanceDB.
- **`test/server.test.ts`**: Integration test verifying clean JSON-RPC stdio communication and vector querying.

## Adding a New Specification

To add a new specification that contains WebDriver BiDi or Classic endpoints, follow these steps:

1.  **Open `scripts/ingest-specs.ts`.**
2.  **Add your specification to the `SPECS` array.** 
    The array contains `SpecConfig` objects. You need to provide:
    - `url`: The public URL of the specification.
    - `type`: A unique identifier for the spec (e.g., `"new-module"`).
    - `rootId` (optional): If the WebDriver-relevant parts are a subset of the page, provide the `id` of the heading where the parsing should start.

    ```typescript
    const SPECS: SpecConfig[] = [
      // ... existing specs
      { 
        url: "https://example.com/spec", 
        type: "my-new-spec",
        rootId: "automated-testing" // Only ingest sections under this heading
      },
    ];
    ```

3.  **Run the ingestion script:**
    ```bash
    npm run ingest
    ```
