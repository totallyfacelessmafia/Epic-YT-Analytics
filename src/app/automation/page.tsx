import { redirect } from "next/navigation";
import AutomationPage from "@/components/AutomationPage";

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function Automation({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessKey = params.key;

  if (!accessKey || accessKey !== process.env.DASHBOARD_ACCESS_KEY) {
    redirect("/not-found");
  }

  return <AutomationPage accessKey={accessKey} />;
}
