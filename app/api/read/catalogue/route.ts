import { readCatalogue } from "@/lib/read/exl";

/** Everything EXL Learn has published, flattened for the Read page. Empty rather than an error when EXL is down. */
export async function GET() {
  try {
    return Response.json(await readCatalogue());
  } catch {
    return Response.json({ subjects: [] });
  }
}
