# WebDriver Spec MCP Agent Guide

This MCP server provides access to the WebDriver BiDi and WebDriver Classic specifications.

## Tools

### `search_specs`
- **Use when:** You need to find information about a specific WebDriver command, event, or concept.
- **Input:** A natural language query describing what you're looking for.
- **Output:** A list of relevant sections from the specs, including their titles, URLs, and a preview of the content.

### `read_spec_section`
- **Use when:** You have found a relevant section using `search_specs` and need to read the full details.
- **Input:** The `url` of the section you want to read.
- **Output:** The full text content of that section.

## Best Practices
1.  **Search first:** Always start by searching for the topic you're interested in.
2.  **Read details:** If the search results aren't enough, use `read_spec_section` to get the full context.
3.  **Distinguish specs:** The results will indicate whether they are from "Classic" (HTTP/JSON) or "BiDi" (Bi-directional/WebSocket). Be aware of which one you need.
