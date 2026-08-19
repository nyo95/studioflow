import { redirect } from "next/navigation";

// The Catalog Board is now the Product Schedule itself — this route redirects
// to the canonical location so old links/bookmarks keep working.
export default async function SketchupCatalogRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/extensions/product-catalog`);
}
