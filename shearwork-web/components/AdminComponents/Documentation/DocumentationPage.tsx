"use client";

import { useState, useCallback, useEffect } from "react";
import ApiDocs from "./ApiDocs";
import LibDocs from "./LibDocs";
import EdgeFunctionDocs from "./EdgeFunctionDocs";
import type { JumpHandler } from "./DocCard";
import { AppPage, PageHeader, Segmented } from "@/components/ui/AppKit";

type Tab = "api" | "lib" | "edge";

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "api", label: "API Routes", description: "Vercel serverless endpoints" },
  { id: "lib", label: "Lib", description: "Utility & helper files" },
  { id: "edge", label: "Edge Functions", description: "Supabase edge functions" },
];

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("api");
  const [highlightedId, setHighlightedId] = useState<string | undefined>();

  // Jump to a specific entry — switches tab if needed, then highlights
  const handleJump: JumpHandler = useCallback((targetId: string, tab: string) => {
    const targetTab = tab as Tab;
    if (activeTab !== targetTab) {
      setActiveTab(targetTab);
      // Wait for the tab content to render before highlighting
      setTimeout(() => {
        setHighlightedId(targetId);
      }, 50);
    } else {
      setHighlightedId(targetId);
    }
  }, [activeTab]);

  // Clear highlight after flash
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(undefined), 2000);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  return (
    <AppPage>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Codebase documentation"
          subtitle="Reference for API routes, utility libraries, and edge functions: their purpose, inputs, outputs, and relationships."
        />

        {/* Tabs */}
        <Segmented
          className="mb-5 w-full overflow-x-auto sm:w-auto"
          options={TABS.map((tab) => ({
            value: tab.id,
            label: <span title={tab.description}>{tab.label}</span>,
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Content */}
        {activeTab === "api" && <ApiDocs highlightedId={highlightedId} onJump={handleJump} />}
        {activeTab === "lib" && <LibDocs highlightedId={highlightedId} onJump={handleJump} />}
        {activeTab === "edge" && <EdgeFunctionDocs highlightedId={highlightedId} onJump={handleJump} />}
      </div>
    </AppPage>
  );
}
