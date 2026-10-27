import type { Metadata } from "next";
import { CatalogView } from "@/components/CatalogView";

export const metadata: Metadata = { title: "Catalogue" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CatalogPage({ searchParams }: Props) {
  return <CatalogView searchParams={await searchParams} />;
}
