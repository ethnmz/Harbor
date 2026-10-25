import { AppShell } from "@/components/app-shell";
import { getWorkspace } from "@/lib/seed";

/** Every page except onboarding lives inside the app shell (rail + top bar). */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell ws={await getWorkspace()}>{children}</AppShell>;
}
