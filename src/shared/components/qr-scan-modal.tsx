"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

export function QrScanModal({
  open,
  title,
  onClose,
  onScanned,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onScanned: (decodedText: string) => void;
}) {
  const regionId = useRef(`qr-region-${Math.random().toString(16).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setStarting(true);
      try {
        const scanner = new Html5Qrcode(regionId.current);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            if (cancelled) return;
            onScanned(decodedText);
          },
          () => {
            // ignore per-frame decode errors
          }
        );
      } finally {
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        Promise.resolve(s.stop())
          .catch(() => {})
          .finally(() => {
            Promise.resolve(s.clear()).catch(() => {});
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 glass-card p-5"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
              SCAN QR
            </p>
            <h3 className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Point your camera at the QR code.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <div id={regionId.current} className="w-full aspect-square bg-black" />
        </div>

        {starting && (
          <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
            Starting camera…
          </p>
        )}
      </div>
    </div>
  );
}

