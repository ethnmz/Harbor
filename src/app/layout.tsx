import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/app-shell";
import { SetupScreen } from "@/components/setup-screen";
import { loadWorkspaceState } from "@/lib/setup";
import "./globals.css";

export const dynamic = "force-dynamic";

const display = Newsreader({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "Harbor: enterprise-ready AI agents in a minute",
  description: "Describe a job in plain English and get a working agent with permissions, approvals, logging and monitoring built in.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Every page needs the workspace; if the database isn't ready, explain why instead of crashing.
  const state = await loadWorkspaceState();
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} font-sans antialiased`}>
        {state.ok ? <AppShell ws={state.ws}>{children}</AppShell> : <SetupScreen state={state} />}
      </body>
    </html>
  );
}
