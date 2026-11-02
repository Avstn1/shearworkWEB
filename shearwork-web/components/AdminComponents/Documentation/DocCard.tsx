"use client";

import { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/AppKit";

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
  api: "badge-info",
  lib: "badge-sage",
  edge: "badge-warn",
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
        cursor-pointer rounded-lg border transition-colors duration-200
        ${highlighted
          ? "border-sage/60 bg-raised"
          : expanded
          ? "border-white/[0.12] bg-raised"
          : "border-white/[0.07] bg-surface hover:border-white/[0.12] hover:bg-raised"
        }
      `}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-[13px] font-semibold text-ivory">
              {entry.name}
            </span>
            {entry.tags?.map((tag) => (
              <span
                key={tag}
                className="badge font-mono font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="truncate font-mono text-[11px] text-gray-500">{entry.path}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="hidden max-w-xs text-xs text-muted md:block">{entry.summary}</p>
          <ChevronIcon expanded={expanded} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div
          className="border-t border-white/[0.07] px-4 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-4 space-y-4">
            {/* Description */}
            <div>
              <h4 className="stat-label mb-2">
                Description
              </h4>
              <p className="text-sm leading-relaxed text-gray-300">{entry.description}</p>
            </div>

            {/* Related */}
            {entry.related && entry.related.length > 0 && (
              <div>
                <h4 className="stat-label mb-2">
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
                      className={`badge ${TYPE_COLORS[rel.type]} px-2 py-1 font-mono text-xs font-medium transition-opacity ${rel.targetId ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                    >
                      <span className="opacity-60">{TYPE_LABELS[rel.type]}</span>
                      {rel.label}
                      {rel.targetId && <ArrowUpRight size={12} strokeWidth={1.75} className="opacity-60" />}
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
    <ChevronDown
      size={16}
      strokeWidth={1.75}
      className={`text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    />
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
    <div className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-center gap-3">
        <h3 className="font-mono text-xs font-medium text-muted">{title}</h3>
        <div className="divider flex-1" />
        <span className="text-xs tabular-nums text-gray-500">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.07]">
          <EmptyState title={emptyMessage} />
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
  icon: Icon,
  title,
  subtitle,
  searchPlaceholder,
  children,
  searchValue,
  onSearchChange,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  children: React.ReactNode;
  searchValue: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <section className="panel">
      <header className="panel-header flex-wrap">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon size={18} strokeWidth={1.75} className="shrink-0 text-sage" />
          <div className="min-w-0">
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle">{subtitle}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="field h-9 pl-9"
          />
        </div>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
