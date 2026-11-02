"use client";

import { useState, useCallback, useEffect } from "react";
import ApiDocs from "./ApiDocs";
import LibDocs from "./LibDocs";
import EdgeFunctionDocs from "./EdgeFunctionDocs";
import type { JumpHandler } from "./DocCard";

type Tab = "api" | "lib" | "edge";

const TABS: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: "api", label: "API Routes", icon: "⬡", description: "Vercel serverless endpoints" },
  { id: "lib", label: "Lib", icon: "◈", description: "Utility & helper files" },
  { id: "edge", label: "Edge Functions", icon: "◎", description: "Supabase edge functions" },
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
    <div className="min-h-screen bg-[#171A18] text-[#ECEDEA]">
      {/* Header */}
      <div className="border-b border-[#2C302D] bg-[#242924]">
        <div className="max-w-7xl mx-auto px-6 pt-25 pb-0">
          <div className="flex items-end gap-3 mb-1">
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#9EA39C] uppercase">
              Admin / Internal Docs
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--highlight)] mb-1"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Codebase Documentation
          </h1>
          <p className="text-sm text-[#9EA39C] mb-6">
            Reference for API routes, utility libraries, and edge functions — their purpose, inputs, outputs, and relationships.
          </p>

          {/* Tabs */}
          <div className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative flex items-center gap-2.5 px-5 py-3 text-sm font-medium
                  border-t border-l border-r transition-all duration-150
                  ${activeTab === tab.id
                    ? "bg-[#171A18] border-[#2C302D] border-b-[#171A18] text-[var(--highlight)] z-10"
                    : "bg-transparent border-transparent text-[#9EA39C] hover:text-[#ECEDEA]"
                  }
                `}
              >
                <span className={`text-base leading-none transition-colors ${activeTab === tab.id ? "text-green-400" : "text-[#2C302D]"}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {activeTab !== tab.id && (
                  <span className="hidden group-hover:block absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-[#9EA39C] whitespace-nowrap">
                    {tab.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "api" && <ApiDocs highlightedId={highlightedId} onJump={handleJump} />}
        {activeTab === "lib" && <LibDocs highlightedId={highlightedId} onJump={handleJump} />}
        {activeTab === "edge" && <EdgeFunctionDocs highlightedId={highlightedId} onJump={handleJump} />}
      </div>
    </div>
  );
}