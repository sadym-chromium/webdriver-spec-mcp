import { Embedder } from "./src/lib/embedder.js";
import { Store } from "./src/lib/store.js";

async function main() {
  const question = "How do I subscribe to log events in BiDi?";
  console.log(`Question: ${question}`);

  const store = new Store();
  const embedder = Embedder.getInstance();
  const vector = await embedder.embed(question);
  const results = await store.search(vector, 3);

  console.log("Found context sections:");
  results.forEach(r => console.log(`- [${r.spec}] ${r.title} (${r.url})`));
}

main().catch(console.error);
