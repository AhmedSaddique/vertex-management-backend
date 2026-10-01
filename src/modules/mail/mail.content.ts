import { env } from "../../config/env";
import { layout, methodLabel, modeLabel, money, remainingLabel, shortDate, type MailMessage, type Row } from "./mail.templates";

export interface ShareLine {
  partnerName: string;
  percent: number;
  amount: number;
}

export interface EnrollmentData {
  admissionNo: number;
  name: string;
  fatherName: string | null;
  phone: string;
  subject: string;
  teacher: string;
  classMode: string;
  fee: number;
  discount: number;
  finalPrice: number;
  paidToDate: number;
  remaining: number;
  enrolledAt: Date;
  installments: { dueDate: Date; amount: number }[];
  // Team copy only: what each member earns from this student's fee.
  shares: ShareLine[];
  companyPercent: number;
  companyAmount: number;
}

export interface PaymentData {
  studentId: string;
  admissionNo: number;
  name: string;
  subject: string;
  teacher: string;
  amount: number;
  method: string;
  paidAt: Date;
  note: string | null;
  finalPrice: number;
  paidToDate: number;
  remaining: number;
  nextDue: { dueDate: Date; amount: number } | null;
  shares: ShareLine[];
  companyShare: number;
}

const planRows = (installments: { dueDate: Date; amount: number }[]): Row[] =>
  installments.map((i, idx) => [`Instalment ${idx + 1} due ${shortDate(i.dueDate)}`, money(i.amount)]);

const shareRows = (shares: ShareLine[]): Row[] =>
  shares.map((s) => [`${s.partnerName} (${s.percent}%)`, money(s.amount)]);

/** Student copy: admission confirmed, then what is received and what is left. */
export function enrollmentStudentMail(d: EnrollmentData): MailMessage {
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Student name", d.name],
    ["Course", d.subject],
    ["Teacher", d.teacher],
    ["Mode of class", modeLabel(d.classMode)],
    ["Admission date", shortDate(d.enrolledAt)],
    ["Course fee", money(d.fee)],
    ...((d.discount > 0 ? [["Discount", `- ${money(d.discount)}`]] : []) as Row[]),
    ["Total payable", money(d.finalPrice)],
    ...planRows(d.installments),
  ];

  const { html, text } = layout({
    title: `Your admission is confirmed`,
    intro: `Welcome to Vertex Trading Academy, <strong>${d.name}</strong>. Your admission is complete and your seat in <strong>${d.subject}</strong> is booked. Your admission number is <strong>#${d.admissionNo}</strong>, please quote it on every payment.`,
    highlight: [
      ["Total fee", money(d.finalPrice)],
      ["Amount received", money(d.paidToDate)],
      ["Remaining amount", remainingLabel(d.remaining)],
    ],
    rows,
    footer: d.installments.length
      ? `Please pay on the dates above. If a date does not suit you, tell the office before it passes and we will reschedule it.`
      : `The office will agree your payment dates with you shortly.`,
  });
  return { subject: `Admission confirmed - #${d.admissionNo} ${d.subject} | Vertex Trading Academy`, html, text };
}

/** Team copy: the same enrollment plus what each member earns from it. */
export function enrollmentTeamMail(d: EnrollmentData): MailMessage {
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Name", d.name],
    ...((d.fatherName ? [["Father name", d.fatherName]] : []) as Row[]),
    ["Phone", d.phone],
    ["Course", d.subject],
    ["Teacher", d.teacher],
    ["Mode of class", modeLabel(d.classMode)],
    ["Course fee", money(d.fee)],
    ["Discount", money(d.discount)],
    ["Final price", money(d.finalPrice)],
    ["Received so far", money(d.paidToDate)],
    ["Remaining", remainingLabel(d.remaining)],
    ...shareRows(d.shares),
    [`Company (${d.companyPercent}%)`, money(d.companyAmount)],
    ...planRows(d.installments),
  ];
  const { html, text } = layout({
    title: `New enrollment: ${d.name}`,
    intro: `${d.name} has been enrolled in ${d.subject} with ${d.teacher}. The share of this fee is listed below.`,
    highlight: [
      ["Final price", money(d.finalPrice)],
      ["Remaining", remainingLabel(d.remaining)],
    ],
    rows,
    footer: `Open the student record: <a href="${env.mail.appUrl}/students">${env.mail.appUrl}/students</a>`,
  });
  return { subject: `[Vertex] New enrollment: ${d.name} (#${d.admissionNo})`, html, text };
}

/** Student copy: receipt with the amount received and the balance left. */
export function paymentStudentMail(d: PaymentData): MailMessage {
  const settled = d.remaining <= 0;
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Student name", d.name],
    ["Course", d.subject],
    ["Payment date", shortDate(d.paidAt)],
    ["Payment method", methodLabel(d.method)],
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining amount", remainingLabel(d.remaining)],
    ...((d.nextDue ? [[`Next instalment due ${shortDate(d.nextDue.dueDate)}`, money(d.nextDue.amount)]] : []) as Row[]),
  ];
  const { html, text } = layout({
    title: settled ? "Payment received, fee complete" : "Payment received, thank you",
    intro: settled
      ? `We have received <strong>${money(d.amount)}</strong> from you. Your course fee is now fully paid and nothing is outstanding. Keep this email as your receipt.`
      : `We have received <strong>${money(d.amount)}</strong> from you against admission number <strong>#${d.admissionNo}</strong>. Your remaining amount is <strong>${money(d.remaining)}</strong>.`,
    highlight: [
      ["Amount received", money(d.amount)],
      ["Remaining amount", remainingLabel(d.remaining)],
    ],
    rows,
    footer: d.nextDue
      ? `Your next instalment of ${money(d.nextDue.amount)} is due on ${shortDate(d.nextDue.dueDate)}.`
      : settled
        ? `No further payments are due.`
        : `The office will agree the date for the remaining amount with you.`,
  });
  return { subject: `Payment received ${money(d.amount)} - #${d.admissionNo} | Vertex Trading Academy`, html, text };
}

/** Team copy: the receipt plus how the payment was split. */
export function paymentTeamMail(d: PaymentData): MailMessage {
  const rows: Row[] = [
    ["Student", `${d.name} (#${d.admissionNo})`],
    ["Course", `${d.subject} · ${d.teacher}`],
    ["Payment date", shortDate(d.paidAt)],
    ["Method", methodLabel(d.method)],
    ...((d.note ? [["Note", d.note]] : []) as Row[]),
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining amount", remainingLabel(d.remaining)],
    ...((d.nextDue ? [[`Next due ${shortDate(d.nextDue.dueDate)}`, money(d.nextDue.amount)]] : [["Next due", "not scheduled"]]) as Row[]),
    ...shareRows(d.shares),
    ["Company share", money(d.companyShare)],
  ];
  const { html, text } = layout({
    title: `Payment received: ${money(d.amount)} from ${d.name}`,
    intro: `${d.name} paid ${money(d.amount)}. Remaining balance is ${remainingLabel(d.remaining)}. The share of this payment is listed below.`,
    highlight: [
      ["Amount received", money(d.amount)],
      ["Remaining amount", remainingLabel(d.remaining)],
    ],
    rows,
    footer: `Open the student record: <a href="${env.mail.appUrl}/students/${d.studentId}">${env.mail.appUrl}/students/${d.studentId}</a>`,
  });
  return { subject: `[Vertex] Payment ${money(d.amount)} from ${d.name} (#${d.admissionNo})`, html, text };
}
