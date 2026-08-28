import lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDataDir(): string {
  if (process.env.MCP_DATA_DIR) {
    return process.env.MCP_DATA_DIR;
  }
  let currentDir = __dirname;
  while (currentDir !== path.dirname(currentDir)) {
    const candidate = path.join(currentDir, ".mcp-data");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const pkgJson = path.join(currentDir, "package.json");
    if (fs.existsSync(pkgJson)) {
      return path.join(currentDir, ".mcp-data");
    }
    currentDir = path.dirname(currentDir);
  }
  return path.resolve(__dirname, "../../.mcp-data");
}

const DATA_DIR = getDataDir();

export interface SpecSection {
  id: string;
  title: string;
  content: string;
  url: string;
  spec: string;
  vector?: number[];
  distance?: number;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_.-]+/g) || []).filter((t) => t.length > 1);
}

export class Store {
  private dbUrl: string;

  constructor() {
    this.dbUrl = DATA_DIR;
    if (!fs.existsSync(this.dbUrl)) {
      fs.mkdirSync(this.dbUrl, { recursive: true });
    }
  }

  private async getTable() {
    const db = await lancedb.connect(this.dbUrl);
    try {
      return await db.openTable("specs");
    } catch {
      return null;
    }
  }

  public async upsert(data: SpecSection[]) {
    const db = await lancedb.connect(this.dbUrl);
    const tableNames = await db.tableNames();
    if (tableNames.includes("specs")) {
      await db.dropTable("specs");
    }
    await db.createTable("specs", data as any);
  }

  public async getByUrl(url: string): Promise<SpecSection | null> {
    const table = await this.getTable();
    if (!table) return null;

    const results = await table.query()
        .where(`url = '${url}'`)
        .limit(1)
        .toArray();
    
    if (results.length === 0) return null;

    const r = results[0];
    return {
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
      url: r.url as string,
      spec: r.spec as string,
    };
  }

  public async search(
    queryOrVector: string | number[],
    vectorOrLimit?: number[] | number,
    limit = 5
  ): Promise<SpecSection[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    let queryText = "";
    let queryVector: number[] | undefined;
    let maxResults = limit;

    if (typeof queryOrVector === "string") {
      queryText = queryOrVector;
      if (Array.isArray(vectorOrLimit)) {
        queryVector = vectorOrLimit;
      } else if (typeof vectorOrLimit === "number") {
        maxResults = vectorOrLimit;
      }
    } else if (Array.isArray(queryOrVector)) {
      queryVector = queryOrVector;
      if (typeof vectorOrLimit === "number") {
        maxResults = vectorOrLimit;
      }
    }

    if (!queryText && queryVector) {
      const results = await table.vectorSearch(queryVector).limit(maxResults).toArray();
      return results.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        content: r.content as string,
        url: r.url as string,
        spec: r.spec as string,
        distance: r._distance,
      }));
    }

    const allRows = await table.query().toArray();
    const N = allRows.length;

    const queryTokens = tokenize(queryText);
    const cleanQuery = queryText.toLowerCase().trim();
    const quotedMatches =
      queryText.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1).toLowerCase()) || [];

    const dfMap = new Map<string, number>();
    for (const token of queryTokens) {
      let count = 0;
      for (const doc of allRows) {
        const fullText = (doc.title + " " + doc.content).toLowerCase();
        if (fullText.includes(token)) count++;
      }
      dfMap.set(token, count);
    }

    const vecDistanceMap = new Map<string, number>();
    if (queryVector) {
      const vecResults = await table.vectorSearch(queryVector).limit(50).toArray();
      vecResults.forEach((r) => vecDistanceMap.set(r.url as string, r._distance as number));
    }

    const scored = allRows.map((doc) => {
      const titleLower = ((doc.title as string) || "").toLowerCase();
      const contentLower = ((doc.content as string) || "").toLowerCase();
      const urlLower = ((doc.url as string) || "").toLowerCase();

      let textScore = 0;

      // Exact full query match
      if (titleLower.includes(cleanQuery)) textScore += 100;
      else if (contentLower.includes(cleanQuery)) textScore += 50;

      // Quoted phrases
      for (const q of quotedMatches) {
        if (titleLower.includes(q)) textScore += 60;
        else if (contentLower.includes(q)) textScore += 40;
      }

      // Token TF-IDF / BM25
      for (const token of queryTokens) {
        const df = dfMap.get(token) || 1;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        if (titleLower.includes(token)) {
          textScore += idf * 10;
        }
        if (urlLower.includes(token)) {
          textScore += idf * 5;
        }

        let tf = 0;
        let pos = 0;
        while ((pos = contentLower.indexOf(token, pos)) !== -1) {
          tf++;
          pos += token.length;
          if (tf >= 10) break;
        }
        if (tf > 0) {
          const tfNorm = (tf * 2.2) / (tf + 1.2);
          textScore += idf * tfNorm * 3;
        }
      }

      // Index & boilerplate penalty
      if (
        titleLower.includes("table of contents") ||
        titleLower.includes("status of this document") ||
        titleLower.includes("issues index") ||
        titleLower === "abstract" ||
        titleLower === "webdriver"
      ) {
        textScore *= 0.1;
      } else if (
        titleLower.includes("index") ||
        titleLower.includes("terms defined") ||
        (titleLower.includes("definition") && !titleLower.includes("the "))
      ) {
        textScore *= 0.4;
      }

      const dist = vecDistanceMap.get(doc.url as string);
      const vecScore = dist !== undefined ? Math.max(0, 1 - dist / 2) : 0;
      const totalScore = textScore + vecScore * 15;

      return {
        row: doc,
        totalScore,
        distance: dist,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    return scored.slice(0, maxResults).map((s) => ({
      id: s.row.id as string,
      title: s.row.title as string,
      content: s.row.content as string,
      url: s.row.url as string,
      spec: s.row.spec as string,
      distance: s.distance,
    }));
  }
}
