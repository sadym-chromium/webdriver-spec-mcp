import { JSDOM } from "jsdom";
import { Embedder } from "../src/lib/embedder.js";
import { Store } from "../src/lib/store.js";
const SPECS = [
    { url: "https://w3c.github.io/webdriver/", type: "classic" },
    { url: "https://w3c.github.io/webdriver-bidi/", type: "bidi" },
];
async function fetchAndParseSpec(url, type) {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const sections = [];
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const embedder = Embedder.getInstance();
    for (const heading of headings) {
        const id = heading.id;
        if (!id)
            continue;
        const title = heading.textContent?.trim() || "";
        let content = "";
        let next = heading.nextElementSibling;
        while (next && !["H1", "H2", "H3", "H4", "H5", "H6"].includes(next.tagName)) {
            content += next.textContent?.trim() + "\n";
            next = next.nextElementSibling;
        }
        if (content.trim()) {
            console.log(`Processing section: ${title}`);
            try {
                const vector = await embedder.embed(`${title}\n${content}`);
                sections.push({
                    id: `${type}-${id}`,
                    title,
                    content: content.trim(),
                    url: `${url}#${id}`,
                    spec: type,
                    vector,
                });
            }
            catch (e) {
                console.error(`Failed to generate embedding for ${title}`, e);
            }
        }
    }
    return sections;
}
async function main() {
    const allSections = [];
    for (const spec of SPECS) {
        const sections = await fetchAndParseSpec(spec.url, spec.type);
        allSections.push(...sections);
    }
    console.log(`Total sections parsed: ${allSections.length}`);
    const store = new Store();
    await store.upsert(allSections);
    console.log("Ingestion complete!");
}
main().catch(console.error);
