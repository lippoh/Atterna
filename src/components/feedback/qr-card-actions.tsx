// src/components/feedback/qr-card-actions.tsx — per-QR actions (Stage G)
// Copy link, download PNG, share, print. Client island: the QR data URL,
// public URL and label arrive as props from the server-rendered page.
// Share falls back to copy where Web Share is unavailable; print opens a
// minimal ink-on-white sheet (QR stays scannable per §7.14).
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconCopy, IconDownload, IconQr } from "@/components/ui/icons";

export function QrCardActions({
  qr,
  url,
  label,
}: {
  qr: string;
  url: string;
  label: string;
}) {
  const t = useTranslations("feedback");
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — the
      // URL stays visible in the card for manual copy.
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const a = document.createElement("a");
    a.href = qr;
    a.download = `atterna-qr${label ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: label || "Atterna feedback", url });
        return;
      } catch {
        return; // user dismissed — not an error
      }
    }
    await copyLink();
  }

  function print() {
    const win = window.open("", "_blank", "width=480,height=560");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${label || "Atterna feedback"}</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px 24px}` +
        `img{width:320px;height:320px}h1{font-size:20px;margin:0 0 8px}p{color:#555;font-size:14px}</style>` +
        `</head><body><h1>${label || "Atterna feedback"}</h1>` +
        `<p>${url}</p><img src="${qr}" alt="QR code" />` +
        `<script>onload=()=>{print();close()}</script></body></html>`
    );
    win.document.close();
  }

  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-sunken";

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <button type="button" onClick={copyLink} className={btn}>
        <IconCopy className="size-3.5" />
        {copied ? t("copied") : t("copy")}
      </button>
      <button type="button" onClick={download} className={btn}>
        <IconDownload className="size-3.5" />
        {t("download")}
      </button>
      <button type="button" onClick={share} className={btn} aria-label={t("share")}>
        <IconQr className="size-3.5" />
        {t("share")}
      </button>
      <button type="button" onClick={print} className={btn} aria-label={t("print")}>
        {t("print")}
      </button>
    </div>
  );
}
