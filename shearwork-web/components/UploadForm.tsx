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
    <div className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          className="border p-2"
          placeholder="Paste barber info or text..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Summarize
        </button>
      </form>
      {summary && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Summary:</h3>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
