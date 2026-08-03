import { searchProducts, getProductById } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  if (id !== null) {
    return Response.json({ item: await getProductById(id) });
  }

  try {
    const res = await searchProducts({
      q: searchParams.get("q") || "",
      cat: searchParams.get("cat") || "All",
      retailer: searchParams.get("retailer") || "All",
      sort: searchParams.get("sort") || "popular",
      page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50)),
    });
    return Response.json(res);
  } catch (err) {
    console.error("[api/products] search failed:", err);
    return Response.json({ error: "Product search failed" }, { status: 500 });
  }
}
