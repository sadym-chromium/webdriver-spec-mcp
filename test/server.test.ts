import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Embedder } from "../src/lib/embedder.js";
import { Store } from "../src/lib/store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("WebDriver Spec MCP Server", () => {
  it("should communicate over stdio with only valid JSON-RPC messages on stdout when running from external working directory", async () => {
    // Run from tmpdir to verify store directory resolution regardless of process.cwd()
    const serverProcess = spawn("node", [path.join(projectRoot, "build/src/index.js")], {
      cwd: os.tmpdir(),
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    let stdoutBuffer = "";
    serverProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      // Keep incomplete trailing line in buffer
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          stdoutLines.push(line.trim());
        }
      }
    });

    let stderrBuffer = "";
    serverProcess.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf8");
      const lines = stderrBuffer.split("\n");
      stderrBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          stderrLines.push(line.trim());
        }
      }
    });

    // Helper to send a request and wait for a response matching the id
    const sendRequest = (req: { jsonrpc: string; id: number; method: string; params?: Record<string, unknown> }) => {
      serverProcess.stdin.write(JSON.stringify(req) + "\n");
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for response to id=${req.id} (${req.method})`));
        }, 10000);

        const interval = setInterval(() => {
          for (const line of stdoutLines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed && parsed.id === req.id) {
                clearTimeout(timeout);
                clearInterval(interval);
                resolve(parsed);
                return;
              }
            } catch {
              // Ignore parse errors here; we assert on all stdout lines later
            }
          }
        }, 50);
      });
    };

    try {
      // 1. Initialize
      const initResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "jetski-test-client", version: "1.0.0" },
        },
      });

      assert.equal(initResponse.jsonrpc, "2.0");
      assert.equal(initResponse.id, 1);
      assert.ok(initResponse.result, "Expected initialize result");
      const initResult = initResponse.result as any;
      assert.equal(initResult.serverInfo?.name, "webdriver-spec-mcp");

      // Verify every stdout line received is valid JSON and contains no dotenv banner
      for (const line of stdoutLines) {
        assert.doesNotThrow(
          () => JSON.parse(line),
          `Stdout contains non-JSON content: "${line}"`
        );
        assert.ok(!line.includes("dotenv"), `Stdout must not contain dotenv logs: "${line}"`);
      }

      // 2. List tools
      const toolsResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      assert.equal(toolsResponse.jsonrpc, "2.0");
      assert.equal(toolsResponse.id, 2);
      const toolsResult = toolsResponse.result as any;
      assert.ok(Array.isArray(toolsResult?.tools), "Expected tools array");
      const toolNames = toolsResult.tools.map((t: any) => t.name);
      assert.ok(toolNames.includes("search_specs"), "Expected search_specs tool");
      assert.ok(toolNames.includes("read_spec_section"), "Expected read_spec_section tool");

      // 3. Call search_specs tool for emulation.setMediaFeaturesOverride
      const searchCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "search_specs",
          arguments: {
            query: "emulation.setMediaFeaturesOverride",
          },
        },
      });

      assert.equal(searchCallResponse.jsonrpc, "2.0");
      assert.equal(searchCallResponse.id, 3);
      const searchResult = searchCallResponse.result as any;
      assert.ok(Array.isArray(searchResult?.content), "Expected search result content array");
      assert.equal(searchResult.content[0]?.type, "text");
      const parsedResults = JSON.parse(searchResult.content[0].text);
      assert.ok(Array.isArray(parsedResults), "Expected parsed results to be an array");
      assert.ok(parsedResults.length > 0, "Expected search results to not be empty");
      assert.ok(
        parsedResults.some((r: any) => r.title.includes("setMediaFeaturesOverride")),
        "Expected emulation.setMediaFeaturesOverride in search results"
      );

      // 4. Call read_spec_section tool
      const firstResultUrl = parsedResults[0].url;
      const readCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "read_spec_section",
          arguments: {
            url: firstResultUrl,
          },
        },
      });

      assert.equal(readCallResponse.jsonrpc, "2.0");
      assert.equal(readCallResponse.id, 4);
      const readResult = readCallResponse.result as any;
      assert.ok(Array.isArray(readResult?.content), "Expected read result content array");
      assert.equal(readResult.content[0]?.type, "text");
      assert.ok(
        readResult.content[0].text.length > 0,
        "Expected non-empty spec section text"
      );

      // Verify all lines on stdout are strictly valid JSON
      for (const line of stdoutLines) {
        assert.doesNotThrow(
          () => JSON.parse(line),
          `Stdout contains non-JSON content: "${line}"`
        );
        assert.ok(!line.includes("dotenv"), `Stdout must not contain dotenv logs: "${line}"`);
      }

      // Verify stderr received log messages
      assert.ok(
        stderrLines.some((l) => l.includes("WebDriver Spec MCP Server running on stdio")),
        "Expected server startup log on stderr"
      );
    } finally {
      serverProcess.kill();
    }
  });

  it("should generate embeddings locally with Embedder", async () => {
    const embedder = Embedder.getInstance();
    const vector = await embedder.embed("WebDriver BiDi session");
    assert.ok(Array.isArray(vector), "Vector should be an array");
    assert.ok(vector.length > 0, "Vector should not be empty");
    assert.ok(
      vector.every((v) => typeof v === "number" && !isNaN(v)),
      "Vector elements should be valid numbers"
    );
  });

  it("should query store by vector and url", async () => {
    const store = new Store();
    const embedder = Embedder.getInstance();
    const vector = await embedder.embed("emulation.setMediaFeaturesOverride");
    const searchResults = await store.search(vector, 3);
    assert.ok(searchResults.length > 0, "Store search should return results");

    const firstUrl = searchResults[0].url;
    const section = await store.getByUrl(firstUrl);
    assert.ok(section, "Store getByUrl should return section");
    assert.equal(section?.url, firstUrl);
  });
});
