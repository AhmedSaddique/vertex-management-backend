import { env } from "../../config/env";
import { layout, money, remainingLabel, shortDate, type MailMessage, type Row } from "./mail.templates";

export interface ReminderDue {
  dueDate: Date;
  amount: number;
  remaining: number;
  overdue: boolean;
  daysLate: number;
}

export interface ReminderData {
  studentId: string;
  admissionNo: number;
  name: string;
  subject: string;
  teacher: string;
  finalPrice: number;
  paidToDate: number;
  remaining: number;
  overdueAmount: number;
  overdueCount: number;
  oldestOverdue: Date | null;
  dues: ReminderDue[];
}

const dueRows = (dues: ReminderDue[]): Row[] =>
  dues.map((d) => [
    `${shortDate(d.dueDate)}${d.overdue ? ` (${d.daysLate} day${d.daysLate === 1 ? "" : "s"} late)` : ""}`,
    money(d.remaining),
  ]);

/** Fee reminder for the student: what is overdue, and what is left on the course. */
export function reminderStudentMail(d: ReminderData): MailMessage {
  const isOverdue = d.overdueAmount > 0;
  const rows: Row[] = [
    ["Admission number", `#${d.admissionNo}`],
    ["Student name", d.name],
    ["Course", d.subject],
    ["Teacher", d.teacher],
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining amount", remainingLabel(d.remaining)],
  ];

  const intro = isOverdue
    ? `This is a reminder that <strong>${money(d.overdueAmount)}</strong> of your course fee is past its due date${
        d.oldestOverdue ? `, the oldest since <strong>${shortDate(d.oldestOverdue)}</strong>` : ""
      }. Please clear it at your earliest, or contact the office if you need a new date.`
    : `This is a reminder that <strong>${money(d.remaining)}</strong> of your course fee is still outstanding. Please clear it at your earliest, or contact the office to agree a date.`;

  const { html, text } = layout({
    title: isOverdue ? "Fee payment overdue" : "Fee payment reminder",
    intro,
    highlight: [
      ...((isOverdue ? [["Overdue now", money(d.overdueAmount)]] : []) as Row[]),
      ["Remaining amount", remainingLabel(d.remaining)],
    ],
    rows,
    footer: `Please quote your admission number <strong>#${d.admissionNo}</strong> when you pay. If you have already paid, kindly ignore this message.`,
  });

  const subject = isOverdue
    ? `Fee overdue ${money(d.overdueAmount)} - #${d.admissionNo} | Vertex Trading Academy`
    : `Fee reminder ${money(d.remaining)} - #${d.admissionNo} | Vertex Trading Academy`;
  return { subject, html, text };
}

/** Team copy so the office knows a reminder went out. */
export function reminderTeamMail(d: ReminderData): MailMessage {
  const rows: Row[] = [
    ["Student", `${d.name} (#${d.admissionNo})`],
    ["Course", `${d.subject} · ${d.teacher}`],
    ["Total course fee", money(d.finalPrice)],
    ["Paid so far", money(d.paidToDate)],
    ["Remaining amount", remainingLabel(d.remaining)],
    ["Overdue now", d.overdueAmount > 0 ? `${money(d.overdueAmount)} across ${d.overdueCount} date(s)` : "nothing overdue"],
    ...dueRows(d.dues),
  ];
  const { html, text } = layout({
    title: `Reminder sent to ${d.name}`,
    intro: `A fee reminder was emailed to ${d.name}. ${
      d.overdueAmount > 0 ? `${money(d.overdueAmount)} is overdue.` : `${money(d.remaining)} is still outstanding.`
    }`,
    highlight: [
      ["Overdue now", d.overdueAmount > 0 ? money(d.overdueAmount) : "none"],
      ["Remaining amount", remainingLabel(d.remaining)],
    ],
    rows,
    footer: `Open the student record: <a href="${env.mail.appUrl}/students/${d.studentId}">${env.mail.appUrl}/students/${d.studentId}</a>`,
  });
  return { subject: `[Vertex] Reminder sent: ${d.name} (#${d.admissionNo})`, html, text };
}
