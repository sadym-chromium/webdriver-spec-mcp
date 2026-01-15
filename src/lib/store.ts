import lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(process.cwd(), ".mcp-data");

export interface SpecSection {
  id: string;
  title: string;
  content: string;
  url: string;
  spec: "classic" | "bidi";
  vector?: number[];
  distance?: number;
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
      spec: r.spec as "classic" | "bidi",
    };
  }

  public async search(queryVector: number[], limit = 5): Promise<SpecSection[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    const results = await table.vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    return results.map(r => ({
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
      url: r.url as string,
      spec: r.spec as "classic" | "bidi",
      distance: r._distance
    }));
  }
}
