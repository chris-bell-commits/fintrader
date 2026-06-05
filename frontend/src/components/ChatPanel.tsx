"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (message: string) => void;
}

export default function ChatPanel({ messages, loading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col panel">
      <span className="panel-title border-b border-gray-200 dark:border-terminal-border">
        AI Assistant
      </span>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-terminal-muted">
            Ask about your portfolio, request analysis, or have me execute trades.
          </p>
        )}
        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}
        {loading && (
          <div className="text-xs text-gray-400 dark:text-terminal-muted">FinTrader is thinking…</div>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-gray-200 p-2 dark:border-terminal-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message FinTrader…"
          className="flex-1 rounded border border-gray-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary dark:border-terminal-border"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-secondary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-white"
            : "bg-gray-100 text-gray-800 dark:bg-terminal-raised dark:text-terminal-text"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.trades && message.trades.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.trades.map((t, i) => (
              <div key={i} className="text-xs font-semibold text-accent">
                {t.side.toUpperCase()} {t.quantity} {t.ticker}
              </div>
            ))}
          </div>
        )}
        {message.watchlist_changes && message.watchlist_changes.length > 0 && (
          <div className="mt-1 space-y-1">
            {message.watchlist_changes.map((c, i) => (
              <div key={i} className="text-xs text-primary">
                {c.action === "add" ? "Added" : "Removed"} {c.ticker}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
