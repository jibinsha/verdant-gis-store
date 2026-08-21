import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const SITE_URL = "https://verdantgis.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL loaded:", !!SUPABASE_URL);
console.log("Supabase key loaded:", !!SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

/*
 * ---------------------------------------------------------
 * FETCH PUBLISHED DATASETS
 * ---------------------------------------------------------
 */

const datasetUrl =
  `${SUPABASE_URL}/rest/v1/datasets` +
  `?select=slug,updated_at,status` +
  `&status=eq.published` +
  `&order=updated_at.desc`;

const response = await fetch(datasetUrl, {
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization:
      `Bearer ${SUPABASE_ANON_KEY}`,
  },
});

if (!response.ok) {
  const errorText =
    await response.text();

  console.error(
    "Failed to fetch datasets:",
    errorText
  );

  process.exit(1);
}

const datasets =
  await response.json();

/*
 * ---------------------------------------------------------
 * STATIC PAGES
 * ---------------------------------------------------------
 */

const staticPages = [
  {
    url: "/",
    priority: "1.0",
    changefreq: "weekly",
  },

  {
    url: "/explore",
    priority: "0.9",
    changefreq: "weekly",
  },

  {
    url: "/map-explorer",
    priority: "0.9",
    changefreq: "weekly",
  },

  {
    url: "/categories",
    priority: "0.9",
    changefreq: "weekly",
  },

  {
    url: "/about",
    priority: "0.5",
    changefreq: "monthly",
  },

  {
    url: "/contact",
    priority: "0.5",
    changefreq: "monthly",
  },
];

/*
 * ---------------------------------------------------------
 * CATEGORY PAGES
 *
 * These are the categories currently used by your site.
 * Add more here when you create new permanent categories.
 * ---------------------------------------------------------
 */

const categories = [
  "administrative",
  "agriculture",
  "water-resources",
  "remote-sensing",
  "land-use-land-cover",
  "environmental",
  "transportation",
  "soil",
  "elevation",
  "climate",
];

/*
 * ---------------------------------------------------------
 * XML ESCAPING
 * ---------------------------------------------------------
 */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/*
 * ---------------------------------------------------------
 * BUILD URL ENTRIES
 * ---------------------------------------------------------
 */

const urls = [];

/*
 * Static pages
 */

for (const page of staticPages) {
  urls.push({
    loc:
      `${SITE_URL}${page.url}`,

    changefreq:
      page.changefreq,

    priority:
      page.priority,
  });
}

/*
 * Category pages
 */

for (const category of categories) {
  urls.push({
    loc:
      `${SITE_URL}/categories/${category}`,

    changefreq:
      "weekly",

    priority:
      "0.8",
  });
}

/*
 * Dataset pages
 */

for (const dataset of datasets) {
  if (!dataset.slug) {
    continue;
  }

  const entry = {
    loc:
      `${SITE_URL}/dataset/${encodeURIComponent(
        dataset.slug
      )}`,

    changefreq:
      "weekly",

    priority:
      "0.8",
  };

  if (dataset.updated_at) {
    const date =
      new Date(dataset.updated_at);

    if (!Number.isNaN(date.getTime())) {
      entry.lastmod =
        date.toISOString();
    }
  }

  urls.push(entry);
}

/*
 * ---------------------------------------------------------
 * GENERATE XML
 * ---------------------------------------------------------
 */

const xmlEntries =
  urls
    .map((entry) => {
      return `
  <url>
    <loc>${escapeXml(
      entry.loc
    )}</loc>
    ${
      entry.lastmod
        ? `<lastmod>${escapeXml(
            entry.lastmod
          )}</lastmod>`
        : ""
    }
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
    })
    .join("");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${xmlEntries}
</urlset>
`;

/*
 * ---------------------------------------------------------
 * WRITE TO PUBLIC/
 * ---------------------------------------------------------
 */

const publicDir =
  path.resolve(
    process.cwd(),
    "public"
  );

fs.mkdirSync(
  publicDir,
  {
    recursive: true,
  }
);

const sitemapPath =
  path.join(
    publicDir,
    "sitemap.xml"
  );

fs.writeFileSync(
  sitemapPath,
  sitemap,
  "utf8"
);

console.log(
  `Sitemap generated successfully: ${urls.length} URLs`
);

console.log(
  `Datasets included: ${datasets.length}`
);