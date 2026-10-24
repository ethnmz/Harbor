import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/seed";

export default async function Home() {
  const ws = await getWorkspace();
  redirect(ws.onboardedAt ? "/dashboard" : "/onboarding");
}
