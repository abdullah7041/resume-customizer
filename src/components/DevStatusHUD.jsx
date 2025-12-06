import { useEffect, useState, useRef } from "react";
import { FileText, Server, AlertCircle, Terminal, Clock } from "lucide-react";

export const useDevStatus = () => {
    const [status, setStatus] = useState({
        ocr: { text: "", status: "idle", chars: 0 }, // idle, parsing, success, error
        api: { model: "gemini-2.5-flash-lite", status: "idle", lastOp: "", latency: 0 },
        error: null
    });

    const startTimeRef = useRef(null);

    useEffect(() => {
        const handleStatusUpdate = (event) => {
            const { type, payload } = event.detail;
            setStatus(prev => {
                if (type === "OCR_UPDATE") {
                    const textLength = payload.text ? payload.text.length : (prev.ocr.text ? prev.ocr.text.length : 0);
                    return { ...prev, ocr: { ...prev.ocr, ...payload, chars: textLength } };
                }
                if (type === "API_UPDATE") {
                    let latency = prev.api.latency;
                    if (payload.status === "active") {
                        startTimeRef.current = Date.now();
                        latency = 0;
                    } else if (payload.status === "idle" && startTimeRef.current) {
                        latency = Date.now() - startTimeRef.current;
                        startTimeRef.current = null;
                    }
                    return { ...prev, api: { ...prev.api, ...payload, latency } };
                }
                if (type === "ERROR") {
                    return { ...prev, error: payload };
                }
                return prev;
            });
        };

        window.addEventListener("airo:dev-status", handleStatusUpdate);
        return () => window.removeEventListener("airo:dev-status", handleStatusUpdate);
    }, []);

    return status;
};

// Helper to dispatch events
export const updateDevStatus = (type, payload) => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("airo:dev-status", {
            detail: { type, payload }
        }));
    }
};

export default function DevStatusHUD() {
    const status = useDevStatus();
    const isDev = import.meta.env.MODE === "development";

    if (!isDev) return null;

    const logRawData = () => {
        console.group("🔍 DevStatus Dump");
        console.log("OCR State:", status.ocr);
        console.log("API State:", status.api);
        console.log("Last Error:", status.error);
        console.groupEnd();
        alert("Check console for raw data dump");
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-zinc-900/95 px-4 py-1.5 text-[10px] font-mono text-zinc-400 border-b border-zinc-800 backdrop-blur-sm shadow-lg">
            <div className="flex items-center gap-6">
                {/* OCR Status */}
                <div className="flex items-center gap-2">
                    <FileText className={`w-3 h-3 ${status.ocr.status === "success" ? "text-emerald-500" :
                        status.ocr.status === "error" ? "text-rose-500" :
                            status.ocr.status === "parsing" ? "text-amber-500 animate-pulse" : "text-zinc-600"
                        }`} />
                    <span className="uppercase tracking-wider font-bold text-zinc-500">OCR</span>
                    <span className={`truncate max-w-[150px] ${status.ocr.status === "success" ? "text-emerald-400" : "text-zinc-500"}`}>
                        {status.ocr.status === "parsing" ? "EXTRACTING..." :
                            status.ocr.text ? `"${status.ocr.text.slice(0, 20)}..."` : "NO DATA"}
                    </span>
                    {status.ocr.chars > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[9px]">
                            {status.ocr.chars.toLocaleString()} chars
                        </span>
                    )}
                </div>

                {/* API Status */}
                <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
                    <Server className={`w-3 h-3 ${status.api.status === "active" ? "text-blue-500 animate-pulse" : "text-zinc-600"
                        }`} />
                    <span className="uppercase tracking-wider font-bold text-zinc-500">API</span>
                    <span className="text-zinc-300">
                        {status.api.lastOp || "IDLE"}
                    </span>
                    <span className="text-zinc-600 px-1">via</span>
                    <span className="text-blue-400/80">{status.api.model}</span>
                    {status.api.latency > 0 && (
                        <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[9px]">
                            <Clock className="w-2.5 h-2.5" />
                            {status.api.latency}ms
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Error Display */}
                {status.error && (
                    <div className="flex items-center gap-2 text-rose-400 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-3 h-3" />
                        <span className="font-medium truncate max-w-[200px]">{status.error}</span>
                    </div>
                )}

                {/* Log Button */}
                <button
                    onClick={logRawData}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Log raw state to console"
                >
                    <Terminal className="w-3 h-3" />
                    <span>LOG RAW</span>
                </button>
            </div>
        </div>
    );
}
