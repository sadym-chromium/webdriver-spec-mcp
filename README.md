# WebDriver Spec MCP Server

This is a Model Context Protocol (MCP) server that provides access to the WebDriver BiDi and Classic specifications. It uses Retrieval-Augmented Generation (RAG) powered by Google's Gemini models to allow you to search, read, and ask questions about the WebDriver specs.

## Features

- **Ingest WebDriver Specs**: Fetches and parses the latest WebDriver BiDi and Classic specifications from W3C.
- **Semantic Search**: Search for relevant sections in the specs using natural language queries (`search_specs`).
- **Read Specs**: Retrieve the full content of specific sections (`read_spec_section`).
- **Q&A**: Ask questions about the specs and get AI-generated answers based on the documentation (`ask_webdriver`).
- **Vector Storage**: Uses [LanceDB](https://lancedb.com/) for efficient local vector storage.

## Tools

The server exposes the following tools:

- `search_specs`: Search the WebDriver BiDi and Classic specifications for relevant sections.
  - Arguments: `query` (string)
- `read_spec_section`: Read the full content of a specific section.
  - Arguments: `url` (string)
- `ask_webdriver`: Ask a question about WebDriver specs.
  - Arguments: `question` (string)

## Prerequisites

- Node.js (v20 or higher recommended)
- A Google Gemini API Key

## Installation

1.  **Clone the repository.**

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure environment:**

    Create a `.env` file in the root directory and add your Gemini API Key. This is required for the ingestion script to work.

    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

4.  **Ingest data:**

    Before using the server, you need to ingest the WebDriver specifications into the local vector store. This script fetches the specs, generates embeddings, and stores them in `.mcp-data/lancedb`.

    ```bash
    npm run ingest
    ```

5.  **Build the project:**

    Compile the TypeScript code:

    ```bash
    npm run build
    ```

6.  **Configure MCP Client:**

    Add the server configuration to your MCP client settings (e.g., `~/.gemini/settings.json` or `claude_desktop_config.json`).

    Make sure to replace `<PATH_TO_REPO>` with the absolute path to this repository.

    ```json
    "webdriver-spec": {
      "command": "node",
      "args": [
        "<PATH_TO_REPO>/build/src/index.js"
      ],
      "env": {
        "GEMINI_API_KEY": "<YOUR_GEMINI_API_KEY>"
      }
    }
    ```

## Architecture

- **`scripts/ingest-specs.ts`**: Fetches HTML from W3C, parses it into sections using `jsdom`, generates embeddings using `text-embedding-004`, and stores them in LanceDB.
- **`src/tools/webdriver.ts`**: Defines the MCP tools for searching and querying the data.
- **`src/lib/store.ts`**: Handles interactions with LanceDB.
- **`src/lib/gemini.ts`**: Handles interactions with the Google Generative AI API.
