import { notFound } from "next/navigation";
import AutomationPage from "@/components/AutomationPage";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function Automation({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessKey = params.key;

  if (!accessKey || accessKey !== process.env.DASHBOARD_ACCESS_KEY) {
    notFound();
  }

  return <AutomationPage accessKey={accessKey} />;
}
