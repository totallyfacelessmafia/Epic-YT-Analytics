import { notFound } from "next/navigation";
import PromptEngine from "@/components/PromptEngine";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function PromptEnginePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessKey = params.key;

  if (!accessKey || accessKey !== process.env.DASHBOARD_ACCESS_KEY) {
    notFound();
  }

  return <PromptEngine accessKey={accessKey} />;
}
