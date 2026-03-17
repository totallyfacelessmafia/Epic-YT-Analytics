import { notFound } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ key?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessKey = params.key;

  if (!accessKey || accessKey !== process.env.DASHBOARD_ACCESS_KEY) {
    notFound();
  }

  return <Dashboard accessKey={accessKey} />;
}
