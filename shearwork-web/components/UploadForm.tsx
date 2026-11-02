"use client";
import { useState } from "react";

export default function UploadForm() {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberData: input }),
    });
    const data = await res.json();
    setSummary(data.summary);
  };

  return (
    <div className="panel panel-body">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          rows={5}
          className="field"
          placeholder="Paste barber info or text..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm self-end">
          Summarize
        </button>
      </form>
      {summary && (
        <div className="mt-4 rounded-lg border border-white/[0.07] bg-raised p-4">
          <h3 className="mb-2 text-[15px] font-semibold text-ivory">Summary</h3>
          <p className="text-sm text-gray-300">{summary}</p>
        </div>
      )}
    </div>
  );
}
