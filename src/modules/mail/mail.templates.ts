import { env } from "../../config/env";

export interface MailMessage {
  subject: string;
  html: string;
  text: string;
}

export const money = (value: number) =>
  `${env.mail.currency} ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const shortDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const MODE_LABEL: Record<string, string> = { PHYSICAL: "Physical", ONLINE: "Online", HYBRID: "Hybrid" };
export const modeLabel = (mode: string) => MODE_LABEL[mode] ?? mode;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online",
  OTHER: "Other",
};
export const methodLabel = (method: string) => METHOD_LABEL[method] ?? method;

export type Row = [string, string];

/** Wraps content in a plain, email-client-safe layout. Tables and inline styles only. */
export function layout(opts: { title: string; intro: string; rows: Row[]; highlight?: Row[]; footer?: string }): { html: string; text: string } {
  const row = ([label, value]: Row) =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right">${value}</td></tr>`;

  const highlightBlock = (opts.highlight ?? [])
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 14px;color:#334155;font-size:14px">${label}</td><td style="padding:10px 14px;color:#0f172a;font-size:18px;font-weight:700;text-align:right">${value}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#4f46e5;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700">Vertex Trading Academy</td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${opts.title}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.5">${opts.intro}</p>
      ${highlightBlock ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:8px;margin-bottom:20px">${highlightBlock}</table>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.rows.map(row).join("")}</table>
      ${opts.footer ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.5">${opts.footer}</p>` : ""}
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px">This is an automated message from Vertex Management.</td></tr>
  </table>
</body></html>`;

  const text = [
    opts.title,
    "",
    opts.intro.replace(/<[^>]+>/g, ""),
    "",
    ...(opts.highlight ?? []).map(([l, v]) => `${l}: ${v}`),
    ...(opts.highlight?.length ? [""] : []),
    ...opts.rows.map(([l, v]) => `${l}: ${v}`),
    ...(opts.footer ? ["", opts.footer.replace(/<[^>]+>/g, "")] : []),
    "",
    "Vertex Trading Academy",
  ].join("\n");

  return { html, text };
}
