/**
 * SLA (Service Level Agreement) Utility for Incident Reports
 * Barangay SLA policy mandates action & resolution within 72 hours (3 days).
 */
export function getSlaStatus(report) {
  if (!report) {
    return {
      isOverdue: false,
      hoursLeft: 0,
      elapsedDays: 0,
      elapsedHours: 0,
      overdueDays: 0,
      overdueHours: 0,
    };
  }

  if (report.status === "resolved") {
    return {
      isOverdue: false,
      isResolved: true,
      hoursLeft: 0,
      elapsedDays: 0,
      elapsedHours: 0,
      overdueDays: 0,
      overdueHours: 0,
    };
  }

  const createdMs = report.createdAt
    ? new Date(report.createdAt).getTime()
    : report.date
    ? new Date(report.date).getTime()
    : Date.now();

  const SLA_HOURS = 72;
  const deadlineMs = report.deadline
    ? new Date(report.deadline).getTime()
    : createdMs + SLA_HOURS * 60 * 60 * 1000;

  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  const elapsedMs = Math.max(0, nowMs - createdMs);
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const elapsedDays = Math.floor(elapsedHours / 24);

  // Overdue if deadline is in the past, or total elapsed hours >= 72, or explicitly flagged as escalated
  const isOverdue = diffHours <= 0 || report.escalated === true || elapsedHours >= SLA_HOURS;
  const overdueHours = isOverdue ? Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60))) : 0;
  const overdueDays = Math.floor(overdueHours / 24);

  return {
    isOverdue,
    hoursLeft: diffHours > 0 ? diffHours : 0,
    overdueHours,
    overdueDays,
    elapsedHours,
    elapsedDays,
    deadlineDate: new Date(deadlineMs),
  };
}
