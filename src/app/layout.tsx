import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/app-shell";
import { SetupScreen } from "@/components/setup-screen";
import { loadWorkspaceState } from "@/lib/setup";
import "./globals.css";

export const dynamic = "force-dynamic";

const sans = Urbanist({ subsets: ["latin"], variable: "--font-urbanist", display: "swap" });

export const metadata: Metadata = {
  title: "Harbor: enterprise-ready AI agents in a minute",
  description: "Describe a job in plain English and get a working agent with permissions, approvals, logging and monitoring built in.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Every page needs the workspace; if the database isn't ready, explain why instead of crashing.
  const state = await loadWorkspaceState();
  return (
    <html lang="en">
      <body className={`${sans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {state.ok ? <AppShell ws={state.ws}>{children}</AppShell> : <SetupScreen state={state} />}
      </body>
    </html>
  );
}
