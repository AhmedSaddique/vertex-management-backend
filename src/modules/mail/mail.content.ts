import { env } from "../../config/env";
import { layout, methodLabel, modeLabel, money, shortDate, type MailMessage, type Row } from "./mail.templates";

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
  enrolledAt: Date;
  installments: { dueDate: Date; amount: number }[];
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
  // Team copy only; never shown to the student.
  shares: { partnerName: string; percent: number; amount: number }[];
  companyShare: number;
}

const planRows = (installments: { dueDate: Date; amount: number }[]): Row[] =>
  installments.map((i, idx) => [`Payment ${idx + 1} due ${shortDate(i.dueDate)}`, money(i.amount)]);

/** Sent to the student when they enroll. No internal share information. */
export function enrollmentStudentMail(d: EnrollmentData): MailMessage {
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Name", d.name],
    ["Course", d.subject],
    ["Teacher", d.teacher],
    ["Mode of class", modeLabel(d.classMode)],
    ["Enrolled on", shortDate(d.enrolledAt)],
    ["Course fee", money(d.fee)],
    ...((d.discount > 0 ? [["Discount", `- ${money(d.discount)}`]] : []) as Row[]),
    ["Total payable", money(d.finalPrice)],
    ...planRows(d.installments),
  ];
  const { html, text } = layout({
    title: `Welcome to Vertex, ${d.name.split(" ")[0]}`,
    intro: `Your enrollment is confirmed. Please keep your admission number <strong>#${d.admissionNo}</strong> for all future payments and queries.`,
    rows,
    highlight: [["Total payable", money(d.finalPrice)]],
    footer: d.installments.length
      ? "Please pay on the dates listed above. If a date does not suit you, contact the office in advance."
      : "Our office will agree a payment schedule with you shortly.",
  });
  return { subject: `Enrollment confirmed - Admission #${d.admissionNo} (${d.subject})`, html, text };
}

/** Sent to the team when a student enrolls. */
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
    ["Payment dates", d.installments.length ? `${d.installments.length} scheduled` : "none yet"],
    ...planRows(d.installments),
  ];
  const { html, text } = layout({
    title: `New enrollment: ${d.name}`,
    intro: `${d.name} has been enrolled in ${d.subject} with ${d.teacher}.`,
    rows,
    highlight: [["Final price", money(d.finalPrice)]],
    footer: `Open the student record: <a href="${env.mail.appUrl}/students">${env.mail.appUrl}/students</a>`,
  });
  return { subject: `[Vertex] New enrollment: ${d.name} (#${d.admissionNo})`, html, text };
}

/** Payment receipt for the student: what was paid and what is left. */
export function paymentStudentMail(d: PaymentData): MailMessage {
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Name", d.name],
    ["Course", d.subject],
    ["Payment date", shortDate(d.paidAt)],
    ["Payment method", methodLabel(d.method)],
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining balance", money(d.remaining)],
    ...((d.nextDue ? [[`Next payment due ${shortDate(d.nextDue.dueDate)}`, money(d.nextDue.amount)]] : []) as Row[]),
  ];
  const settled = d.remaining <= 0;
  const { html, text } = layout({
    title: `Payment received: ${money(d.amount)}`,
    intro: settled
      ? `Thank you. Your course fee is now fully paid.`
      : `Thank you for your payment of <strong>${money(d.amount)}</strong>. Your remaining balance is <strong>${money(d.remaining)}</strong>.`,
    rows,
    highlight: [
      ["Amount received", money(d.amount)],
      ["Remaining balance", settled ? "Fully paid" : money(d.remaining)],
    ],
    footer: d.nextDue
      ? `Your next payment of ${money(d.nextDue.amount)} is due on ${shortDate(d.nextDue.dueDate)}.`
      : settled
        ? "No further payments are due. Keep this email as your receipt."
        : "Our office will contact you to agree the date for the remaining amount.",
  });
  return { subject: `Payment received ${money(d.amount)} - Admission #${d.admissionNo}`, html, text };
}

/** Team copy of a payment, including how it was split. */
export function paymentTeamMail(d: PaymentData): MailMessage {
  const rows: Row[] = [
    ["Student", `${d.name} (#${d.admissionNo})`],
    ["Course", `${d.subject} · ${d.teacher}`],
    ["Payment date", shortDate(d.paidAt)],
    ["Method", methodLabel(d.method)],
    ...((d.note ? [["Note", d.note]] : []) as Row[]),
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining balance", money(d.remaining)],
    ...((d.nextDue ? [[`Next due ${shortDate(d.nextDue.dueDate)}`, money(d.nextDue.amount)]] : [["Next due", "not scheduled"]]) as Row[]),
    ...(d.shares.map((s) => [`${s.partnerName} share (${s.percent}%)`, money(s.amount)]) as Row[]),
    ["Company share", money(d.companyShare)],
  ];
  const { html, text } = layout({
    title: `Payment received: ${money(d.amount)} from ${d.name}`,
    intro: `${d.name} paid ${money(d.amount)}. Remaining balance is ${money(d.remaining)}.`,
    rows,
    highlight: [
      ["Amount received", money(d.amount)],
      ["Remaining balance", d.remaining <= 0 ? "Fully paid" : money(d.remaining)],
    ],
    footer: `Open the student record: <a href="${env.mail.appUrl}/students/${d.studentId}">${env.mail.appUrl}/students/${d.studentId}</a>`,
  });
  return { subject: `[Vertex] Payment ${money(d.amount)} from ${d.name} (#${d.admissionNo})`, html, text };
}
