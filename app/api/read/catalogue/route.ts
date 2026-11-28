import { readCatalogue } from "@/lib/read/exl";

/** Cached at the edge and in browsers: new lessons show up within a few minutes. */
const CACHE = { "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600" };

/** Everything EXL Learn has published, flattened for the Read page. Empty rather than an error when EXL is down. */
export async function GET() {
  try {
    return Response.json(await readCatalogue(), { headers: CACHE });
  } catch {
    // Short, so a brief outage is not remembered for long.
    return Response.json({ subjects: [] }, { headers: { "cache-control": "public, s-maxage=30" } });
  }
}
