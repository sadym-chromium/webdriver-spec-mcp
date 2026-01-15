import { Embedder } from "./src/lib/embedder.js";
import { Store } from "./src/lib/store.js";

async function test() {
  console.log("Initializing Embedder...");
  const embedder = Embedder.getInstance();
  await embedder.init();

  console.log("Connecting to Store...");
  const store = new Store();

  const query = "how to create a new session";
  console.log(`\nSearching for: "${query}"...`);

  const vector = await embedder.embed(query);
  const results = await store.search(vector);

  console.log(`\nFound ${results.length} results:`);
  results.forEach((r, i) => {
    console.log(`\n[${i + 1}] ${r.title} (${r.spec})`);
    console.log(`    URL: ${r.url}`);
    console.log(`    Distance: ${r.distance}`);
    console.log(`    Preview: ${r.content.substring(0, 100).replace(/\n/g, " ") }...`);
  });
}

test().catch(console.error);
