"use client";

import { useState, useRef } from "react";

type LogEntry = {
  id: number;
  timestamp: string;
  type: "info" | "progress" | "success" | "error" | "warning";
  message: string;
};

export default function CancellationTestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);

  const addLog = (
    type: LogEntry["type"],
    message: string
  ) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      type,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  };

  const startRequest = async () => {
    // Clear previous state
    setLogs([]);
    setProgress(0);
    setIsRunning(true);
    logIdRef.current = 0;

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    addLog("info", "Starting slow request...");

    try {
      const response = await fetch("/api/slow", {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addLog("info", "Connection established, receiving stream...");

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          addLog("info", "Stream ended");
          break;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                setProgress((data.step / data.totalSteps) * 100);
                addLog("progress", data.message);
              } else if (data.type === "complete") {
                setProgress(100);
                addLog("success", data.message);
              } else if (data.type === "cancelled") {
                addLog("warning", `Server acknowledged cancellation at step ${data.step}`);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          addLog("warning", "Request was cancelled by user");
        } else {
          addLog("error", `Error: ${error.message}`);
        }
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      addLog("info", "Cancelling request...");
      abortControllerRef.current.abort();
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setProgress(0);
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return "text-cyan-400";
      case "progress":
        return "text-blue-400";
      case "success":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-amber-400";
      default:
        return "text-gray-400";
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return "ℹ";
      case "progress":
        return "⏳";
      case "success":
        return "✓";
      case "error":
        return "✗";
      case "warning":
        return "⚠";
      default:
        return "•";
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Request Cancellation Test
          </h1>
          <p className="text-gray-400 text-sm">
            Test Vercel&apos;s{" "}
            <a
              href="https://vercel.com/changelog/node-js-vercel-functions-now-support-per-path-request-cancellation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              per-path request cancellation
            </a>{" "}
            feature. Start a slow request and cancel it mid-flight.
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={startRequest}
            disabled={isRunning}
            className={`
              px-5 py-2.5 rounded-lg font-medium text-sm
              transition-all duration-200
              ${
                isRunning
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/25"
              }
            `}
          >
            {isRunning ? "Running..." : "Start Request"}
          </button>

          <button
            onClick={cancelRequest}
            disabled={!isRunning}
            className={`
              px-5 py-2.5 rounded-lg font-medium text-sm
              transition-all duration-200
              ${
                !isRunning
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-400 hover:to-orange-400 shadow-lg shadow-red-500/25"
              }
            `}
          >
            Cancel Request
          </button>

          <button
            onClick={clearLogs}
            disabled={isRunning}
            className={`
              px-5 py-2.5 rounded-lg font-medium text-sm
              transition-all duration-200
              ${
                isRunning
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
              }
            `}
          >
            Clear
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                progress === 100
                  ? "bg-gradient-to-r from-emerald-500 to-green-400"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Log Console */}
        <div className="bg-[#161b22] rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1c2128]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-gray-500 ml-2 font-mono">
                console
              </span>
            </div>
            <div
              className={`flex items-center gap-2 text-xs ${
                isRunning ? "text-cyan-400" : "text-gray-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? "bg-cyan-400 animate-pulse" : "bg-gray-600"
                }`}
              />
              {isRunning ? "Active" : "Idle"}
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                <span>Click &quot;Start Request&quot; to begin</span>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <span className="text-gray-600 shrink-0">
                      {log.timestamp}
                    </span>
                    <span className={`shrink-0 ${getLogColor(log.type)}`}>
                      {getLogIcon(log.type)}
                    </span>
                    <span className={getLogColor(log.type)}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-[#161b22] rounded-xl border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">
            How it works
          </h3>
          <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
            <li>
              The API route at <code className="text-cyan-400">/api/slow</code>{" "}
              simulates a 10-second operation
            </li>
            <li>
              <code className="text-cyan-400">vercel.json</code> has{" "}
              <code className="text-amber-400">supportsCancellation: true</code>{" "}
              for API routes
            </li>
            <li>
              When cancelled, the server receives{" "}
              <code className="text-cyan-400">request.signal.aborted</code> and
              stops processing
            </li>
            <li>
              Check the Vercel function logs to see the cancellation message
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
