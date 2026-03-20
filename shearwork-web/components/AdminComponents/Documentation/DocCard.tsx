"use client";

import { useState, useEffect, useRef } from "react";

export type RelatedItem = {
  label: string;
  type: "api" | "lib" | "edge";
  targetId?: string; // the DocEntry id to jump to
};

export type DocEntry = {
  id: string;
  name: string;
  path: string;
  summary: string;
  description: string;
  tags?: string[];
  related?: RelatedItem[];
};

const TYPE_COLORS: Record<RelatedItem["type"], string> = {
  api: "bg-sky-600/15 text-sky-300 border-sky-600/30 hover:bg-sky-600/25",
  lib: "bg-green-600/15 text-green-400 border-green-600/30 hover:bg-green-600/25",
  edge: "bg-purple-600/15 text-purple-300 border-purple-600/30 hover:bg-purple-600/25",
};

const TYPE_LABELS: Record<RelatedItem["type"], string> = {
  api: "API",
  lib: "Lib",
  edge: "Edge",
};

// Tab key for each type — used to switch tabs on jump
export const TYPE_TAB: Record<RelatedItem["type"], string> = {
  api: "api",
  lib: "lib",
  edge: "edge",
};

export type JumpHandler = (targetId: string, tab: string) => void;

export function DocCard({
  entry,
  highlighted,
  onJump,
}: {
  entry: DocEntry;
  highlighted?: boolean;
  onJump?: JumpHandler;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Auto-expand and flash when jumped to
  useEffect(() => {
    if (highlighted) {
      setExpanded(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  return (
    <div
      id={entry.id}
      ref={ref}
      className={`
        rounded-lg border transition-all duration-300 cursor-pointer
        ${highlighted
          ? "border-green-500/70 bg-[#2a2f27] ring-2 ring-green-500/20"
          : expanded
          ? "border-[#55694b] bg-[#2a2f27]"
          : "border-[#55694b]/40 bg-[#242924] hover:border-[#55694b] hover:bg-[#2a2f27]"
        }
      `}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-[var(--highlight)]">
              {entry.name}
            </span>
            {entry.tags?.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3a4431] text-[#9ca89a] border border-[#55694b]/50"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[11px] font-mono text-[#9ca89a]/60 truncate">{entry.path}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs text-[#9ca89a] max-w-xs hidden md:block">{entry.summary}</p>
          <ChevronIcon expanded={expanded} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div
          className="px-4 pb-4 border-t border-[#55694b]/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-4 space-y-4">
            {/* Description */}
            <div>
              <h4 className="text-[10px] font-mono tracking-widest text-[#9ca89a]/60 uppercase mb-2">
                Description
              </h4>
              <p className="text-sm text-[#F1F5E9]/80 leading-relaxed">{entry.description}</p>
            </div>

            {/* Related */}
            {entry.related && entry.related.length > 0 && (
              <div>
                <h4 className="text-[10px] font-mono tracking-widest text-[#9ca89a]/60 uppercase mb-2">
                  Related
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entry.related.map((rel, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rel.targetId && onJump) {
                          onJump(rel.targetId, TYPE_TAB[rel.type]);
                        }
                      }}
                      className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${TYPE_COLORS[rel.type]} ${rel.targetId ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="opacity-60 mr-1">{TYPE_LABELS[rel.type]}</span>
                      {rel.label}
                      {rel.targetId && <span className="ml-1 opacity-50">↗</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={`text-[#9ca89a] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DocSection({
  title,
  entries,
  emptyMessage = "No entries yet.",
  highlightedId,
  onJump,
}: {
  title: string;
  entries: DocEntry[];
  emptyMessage?: string;
  highlightedId?: string;
  onJump?: JumpHandler;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs font-mono tracking-[0.2em] uppercase text-[#9ca89a]">{title}</h2>
        <div className="flex-1 h-px bg-[#55694b]/40" />
        <span className="text-xs font-mono text-[#9ca89a]/60">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#55694b]/40 py-8 text-center">
          <p className="text-sm text-[#9ca89a]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <DocCard
              key={entry.id}
              entry={entry}
              highlighted={highlightedId === entry.id}
              onJump={onJump}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocTabShell({
  icon,
  title,
  subtitle,
  searchPlaceholder,
  children,
  searchValue,
  onSearchChange,
}: {
  icon: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  children: React.ReactNode;
  searchValue: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{icon}</span>
            <h2
              className="text-lg font-semibold text-[var(--highlight)]"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
            >
              {title}
            </h2>
          </div>
          <p className="text-xs text-[#9ca89a]">{subtitle}</p>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca89a] text-sm">⌕</span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#242924] border border-[#55694b]/50 rounded-lg pl-8 pr-4 py-2 text-sm text-[#F1F5E9] placeholder-[#9ca89a]/50 focus:outline-none focus:border-[#55694b] transition-colors"
          />
        </div>
      </div>
      {children}
    </div>
  );
}