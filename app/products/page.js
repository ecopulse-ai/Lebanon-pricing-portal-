import ProductsExplorer from "@/components/ProductsExplorer";
import { getCategories, getCatalogueMeta } from "@/lib/products";
import { getLocale } from "@/lib/locale-server";

export const metadata = {
  title: "Products — Lebanon Prices Intelligence Unit",
  description: "Search the full standardized catalogue of Lebanese retail goods — price range in USD and LBP, category, brand and origin.",
};

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const initialId = typeof sp?.p === "string" ? sp.p : null;
  const locale = await getLocale();
  return (
    <ProductsExplorer
      categories={getCategories()}
      meta={getCatalogueMeta()}
      initialId={initialId}
      locale={locale}
    />
  );
}
