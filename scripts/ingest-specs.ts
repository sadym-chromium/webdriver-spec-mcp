import { JSDOM } from "jsdom";
import { Embedder } from "../src/lib/embedder.js";
import { Store, SpecSection } from "../src/lib/store.js";

type SpecConfig = {
  url: string;
  type: string;
  rootId?: string;
};

const SPECS: SpecConfig[] = [
  { url: "https://www.w3.org/TR/webdriver/", type: "classic" },
  { url: "https://w3c.github.io/webdriver-bidi/", type: "bidi" },
  { url: "https://www.w3.org/TR/permissions/", type: "permissions", rootId: "automation" },
  { url: "https://wicg.github.io/nav-speculation/prefetch.html", type: "prefetch", rootId: "automated-testing" },
  { url: "https://webbluetoothcg.github.io/web-bluetooth/", type: "bluetooth", rootId: "automated-testing" },
  { url: "https://wicg.github.io/ua-client-hints", type: "ua-client-hints", rootId: "automation" },
];

async function fetchAndParseSpec(url: string, type: string, rootId?: string): Promise<SpecSection[]> {
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const sections: SpecSection[] = [];
  let headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const embedder = Embedder.getInstance();

  if (rootId) {
    const startHeadingIndex = headings.findIndex(h => h.id === rootId);
    if (startHeadingIndex === -1) {
      console.warn(`Root ID "${rootId}" not found in ${url}`);
      return [];
    }
    
    const startHeading = headings[startHeadingIndex];
    const startLevel = parseInt(startHeading.tagName.substring(1), 10);
    
    // Filter headings to only include the subtree
    const subtreeHeadings: Element[] = [startHeading];
    
    for (let i = startHeadingIndex + 1; i < headings.length; i++) {
      const currentHeading = headings[i];
      const currentLevel = parseInt(currentHeading.tagName.substring(1), 10);
      
      // Stop if we encounter a sibling or parent of the start node
      if (currentLevel <= startLevel) {
        break;
      }
      subtreeHeadings.push(currentHeading);
    }
    
    headings = subtreeHeadings as any;
  }

  for (const heading of headings) {
    const id = heading.id;
    if (!id) continue;

    const title = heading.textContent?.trim() || "";
    let content = "";
    
    // Logic to handle "flat" specs (h2, p, h2) vs "nested" specs (section > h2, p)
    // If the heading is wrapped in a div/header-wrapper, skip to the wrapper's sibling
    let next = heading.nextElementSibling;
    
    // specific fix for W3C TR specs where h2 is inside div.header-wrapper
    if (heading.parentElement?.tagName === "DIV" && heading.parentElement.className.includes("header-wrapper")) {
        next = heading.parentElement.nextElementSibling;
    }

    while (next) {
       const tagName = next.tagName;
       // Stop at next heading
       if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(tagName)) {
           break;
       }
       
       // For nested sections, if we hit a SECTION tag, it usually starts a new subsection with its own header.
       // We should probably NOT include its text in the parent to avoid duplication, 
       // OR we accept duplication for context. 
       // Given reasonable chunking, stopping at SECTION might be better if the section has a header.
       // But checking if section has header is expensive? 
       // Let's stop at SECTION if it seems to be a sibling section.
       // In TR specs, sections are nested.
       // <section h2> contents <section h3>...</section> </section>
       // If we stop at section, we miss the sub-contents if we wanted them aggregated?
       // But we serve specific sections.
       // So stopping at SECTION is better to keep chunks focused.
       if (tagName === "SECTION") {
           break;
       }
       
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
      } catch (e) {
          console.error(`Failed to generate embedding for ${title}`, e);
      }
    }
  }

  return sections;
}

async function main() {
  const allSections: SpecSection[] = [];

  for (const spec of SPECS) {
    const sections = await fetchAndParseSpec(spec.url, spec.type, spec.rootId);
    allSections.push(...sections);
  }

  console.log(`Total sections parsed: ${allSections.length}`);
  
  const store = new Store();
  await store.upsert(allSections);
  
  console.log("Ingestion complete!");
}

main().catch(console.error);
