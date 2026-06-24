import { searchProducts, getProductById } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  if (id !== null) {
    return Response.json({ item: getProductById(id) });
  }

  const res = searchProducts({
    q: searchParams.get("q") || "",
    cat: searchParams.get("cat") || "All",
    sort: searchParams.get("sort") || "popular",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
    pageSize: Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50)),
  });
  return Response.json(res);
}
