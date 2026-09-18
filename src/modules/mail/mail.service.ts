import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import { prisma } from "../../database/prisma";
import { num, round2 } from "../../common/utils/money";
import type { MailMessage } from "./mail.templates";
import {
  enrollmentStudentMail,
  enrollmentTeamMail,
  paymentStudentMail,
  paymentTeamMail,
  type EnrollmentData,
  type PaymentData,
} from "./mail.content";

export interface NotificationResult {
  studentEmailed: boolean;
  teamEmailed: boolean;
  /** Why nothing was sent, for the UI and the logs. */
  skipped?: string;
}

// Emails must never hold up or fail a save, so every send is bounded.
const SEND_TIMEOUT_MS = Number(process.env.MAIL_TIMEOUT_MS ?? 9000);

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (env.mail.driver === "json") {
    // Builds the message and returns it instead of delivering, for local checks.
    transport = nodemailer.createTransport({ jsonTransport: true });
  } else if (env.mail.configured) {
    transport = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: { user: env.mail.user, pass: env.mail.pass },
    });
  } else {
    transport = null;
  }
  return transport;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`mail timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function send(to: string[], message: MailMessage): Promise<boolean> {
  const t = getTransport();
  if (!t || to.length === 0) return false;
  try {
    const info = await withTimeout(
      t.sendMail({
        from: env.mail.from || env.mail.user,
        to: to.join(", "),
        replyTo: env.mail.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      SEND_TIMEOUT_MS,
    );
    if (env.mail.driver === "json") {
      console.log(`[mail:json] ${message.subject} -> ${to.join(", ")}`);
    } else {
      console.log(`[mail] sent "${message.subject}" to ${to.length} recipient(s)`, (info as { messageId?: string }).messageId ?? "");
    }
    return true;
  } catch (err) {
    // Logged and swallowed: the student and payment records are already saved.
    console.error(`[mail] failed to send "${message.subject}":`, (err as Error).message);
    return false;
  }
}

function unconfigured(): NotificationResult | null {
  if (env.mail.configured) return null;
  return { studentEmailed: false, teamEmailed: false, skipped: "email not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)" };
}

/** Enrollment confirmation to the student plus a copy to the team. */
export async function notifyEnrollment(studentId: string): Promise<NotificationResult> {
  const skip = unconfigured();
  if (skip) return skip;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { user: { select: { name: true } } } },
      installments: { orderBy: { dueDate: "asc" }, select: { dueDate: true, amount: true } },
    },
  });
  if (!student) return { studentEmailed: false, teamEmailed: false, skipped: "student not found" };

  const data: EnrollmentData = {
    admissionNo: student.admissionNo,
    name: student.name,
    fatherName: student.fatherName,
    phone: student.phone,
    subject: student.subject.name,
    teacher: student.teacher.user.name,
    classMode: student.classMode,
    fee: num(student.fee),
    discount: num(student.discount),
    finalPrice: num(student.finalPrice),
    enrolledAt: student.enrolledAt,
    installments: student.installments.map((i) => ({ dueDate: i.dueDate, amount: num(i.amount) })),
  };

  const [studentEmailed, teamEmailed] = await Promise.all([
    student.email ? send([student.email], enrollmentStudentMail(data)) : Promise.resolve(false),
    send(env.mail.notify, enrollmentTeamMail(data)),
  ]);

  return {
    studentEmailed,
    teamEmailed,
    skipped: student.email ? undefined : "student has no email address",
  };
}

/** Payment receipt to the student plus a copy to the team, with the remaining balance. */
export async function notifyPayment(paymentId: string): Promise<NotificationResult> {
  const skip = unconfigured();
  if (skip) return skip;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      shares: { include: { partner: { select: { name: true } } } },
      student: {
        include: {
          subject: { select: { name: true } },
          teacher: { select: { user: { select: { name: true } } } },
          payments: { select: { amount: true } },
          installments: { orderBy: { dueDate: "asc" } },
        },
      },
    },
  });
  if (!payment) return { studentEmailed: false, teamEmailed: false, skipped: "payment not found" };

  const s = payment.student;
  const paidToDate = round2(s.payments.reduce((sum, p) => sum + num(p.amount), 0));
  const finalPrice = num(s.finalPrice);
  const open = s.installments.find((i) => round2(num(i.amount) - num(i.paidAmount)) > 0);
  const shares = payment.shares.map((sh) => ({
    partnerName: sh.partner.name,
    percent: num(sh.percent),
    amount: num(sh.amount),
  }));

  const data: PaymentData = {
    studentId: s.id,
    admissionNo: s.admissionNo,
    name: s.name,
    subject: s.subject.name,
    teacher: s.teacher.user.name,
    amount: num(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt,
    note: payment.note,
    finalPrice,
    paidToDate,
    remaining: round2(finalPrice - paidToDate),
    nextDue: open ? { dueDate: open.dueDate, amount: round2(num(open.amount) - num(open.paidAmount)) } : null,
    shares,
    companyShare: round2(num(payment.amount) - shares.reduce((a, x) => a + x.amount, 0)),
  };

  const [studentEmailed, teamEmailed] = await Promise.all([
    s.email ? send([s.email], paymentStudentMail(data)) : Promise.resolve(false),
    send(env.mail.notify, paymentTeamMail(data)),
  ]);

  return { studentEmailed, teamEmailed, skipped: s.email ? undefined : "student has no email address" };
}

/** Used by /api/health and the settings page. */
export function mailStatus() {
  return {
    configured: env.mail.configured,
    driver: env.mail.driver,
    recipients: env.mail.notify.length,
  };
}
