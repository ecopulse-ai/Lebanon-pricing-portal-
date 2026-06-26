import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

// Active locale for server components, read from the `locale` cookie.
export async function getLocale() {
  const store = await cookies();
  const v = store.get("locale")?.value;
  return LOCALES.includes(v) ? v : DEFAULT_LOCALE;
}
