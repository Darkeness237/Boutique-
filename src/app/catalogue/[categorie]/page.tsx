import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/CatalogView";
import { getCategory } from "@/lib/catalog";

type Props = {
  params: Promise<{ categorie: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).categorie);
  return category ? { title: category.name, description: category.hint } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategory((await params).categorie);
  if (!category) notFound();
  return <CatalogView category={category} searchParams={await searchParams} />;
}
