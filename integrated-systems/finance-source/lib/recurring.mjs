const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function parseDateOnly(value) {
  if (!DATE_RE.test(String(value ?? ""))) {
    throw new RangeError("Tarih YYYY-AA-GG biçiminde olmalıdır.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Geçersiz takvim tarihi.");
  }
  return date;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(value) {
  const date = parseDateOnly(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(value, days) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return toDateOnly(date);
}

export function addMonthsAnchored(value, months) {
  const anchor = parseDateOnly(value);
  if (!Number.isInteger(months)) {
    throw new RangeError("Ay adımı tam sayı olmalıdır.");
  }
  const targetFirst = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(
      targetFirst.getUTCFullYear(),
      targetFirst.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  targetFirst.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return toDateOnly(targetFirst);
}

function lastBusinessDay(value) {
  const date = parseDateOnly(value);
  const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return toDateOnly(candidate);
}

function normalizeRule(rule) {
  const legacyFrequency = Number(rule.frequencyMonths || 1);
  const kind = ["weekly", "monthly", "yearly", "once"].includes(rule.recurrenceKind)
    ? rule.recurrenceKind
    : "monthly";
  const interval = Number.isInteger(Number(rule.recurrenceInterval)) && Number(rule.recurrenceInterval) > 0
    ? Number(rule.recurrenceInterval)
    : kind === "monthly"
      ? Math.max(1, legacyFrequency)
      : 1;
  return {
    kind,
    interval,
    dayOfWeek: Number.isInteger(Number(rule.recurrenceDayOfWeek)) ? Number(rule.recurrenceDayOfWeek) : null,
    dayOfMonth: Number.isInteger(Number(rule.recurrenceDayOfMonth)) ? Number(rule.recurrenceDayOfMonth) : null,
    businessDayRule: rule.businessDayRule === "last_business_day" ? "last_business_day" : "none",
  };
}

function alignWeeklyStart(startDate, dayOfWeek) {
  if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) return startDate;
  const start = parseDateOnly(startDate);
  const shift = (dayOfWeek - start.getUTCDay() + 7) % 7;
  return addDays(startDate, shift);
}

function monthlyDueDate(startDate, step, interval, recurrence) {
  let due = addMonthsAnchored(startDate, step * interval);
  if (recurrence.dayOfMonth) {
    const base = parseDateOnly(due);
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(recurrence.dayOfMonth, last));
    due = toDateOnly(base);
  }
  if (recurrence.businessDayRule === "last_business_day") due = lastBusinessDay(due);
  return due;
}

function recurringDueDate(rule, step) {
  const recurrence = normalizeRule(rule);
  if (recurrence.kind === "once") return step === 0 ? rule.startDate : null;
  if (recurrence.kind === "weekly") {
    const first = alignWeeklyStart(rule.startDate, recurrence.dayOfWeek);
    return addDays(first, step * recurrence.interval * 7);
  }
  if (recurrence.kind === "yearly") {
    return addMonthsAnchored(rule.startDate, step * recurrence.interval * 12);
  }
  return monthlyDueDate(rule.startDate, step, recurrence.interval, recurrence);
}

export function recurringOccurrenceId(ruleId, dueDate) {
  return `recurring-${ruleId}-${dueDate}`;
}

export function projectRecurringExpenses(
  rules,
  savedOccurrences,
  today,
  { monthsAhead = 18, monthsBack = 2 } = {},
) {
  parseDateOnly(today);
  const windowStart = new Date(monthStart(today));
  windowStart.setUTCMonth(windowStart.getUTCMonth() - monthsBack);
  const windowEnd = new Date(monthStart(today));
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + monthsAhead + 1);
  windowEnd.setUTCDate(0);

  const savedMap = new Map(
    savedOccurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  const projected = [];

  for (const rule of rules) {
    const recurrence = normalizeRule(rule);
    if (!Number.isInteger(recurrence.interval) || recurrence.interval < 1) {
      throw new RangeError("Tekrar aralığı en az 1 olmalıdır.");
    }
    const amount = Number(rule.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError("Dönemsel gider tutarı geçersiz.");
    }
    const start = parseDateOnly(rule.startDate);
    const end = rule.endDate ? parseDateOnly(rule.endDate) : null;
    const review = rule.nextReviewDate
      ? parseDateOnly(rule.nextReviewDate)
      : null;

    if (!rule.active) {
      for (const saved of savedOccurrences) {
        if (saved.ruleId !== rule.id) continue;
        const due = parseDateOnly(saved.dueDate);
        if (due < windowStart || due > windowEnd) continue;
        projected.push({
          id: saved.id,
          ruleId: rule.id,
          dueDate: saved.dueDate,
          expectedAmount: Number(saved.expectedAmount),
          actualAmount: saved.actualAmount,
          status: saved.status,
          paidDate: saved.paidDate,
          transactionId: saved.transactionId,
          paymentMethod: saved.paymentMethod ?? rule.paymentMethod,
          documentType: saved.documentType ?? rule.documentType,
          documentRef: saved.documentRef ?? "",
          note: saved.note ?? "",
          needsAmount: false,
          needsReview: false,
          overdue: false,
        });
      }
      continue;
    }

    for (let step = 0; step < 1500; step += 1) {
      const dueDate = recurringDueDate(rule, step);
      if (!dueDate) break;
      const due = parseDateOnly(dueDate);
      if (due > windowEnd || (end && due > end)) break;
      const effectiveStart = recurrence.businessDayRule === "last_business_day"
        ? monthStart(rule.startDate)
        : start;
      if (due < effectiveStart || due < windowStart) continue;

      const id = recurringOccurrenceId(rule.id, dueDate);
      const saved = savedMap.get(id);
      projected.push({
        id,
        ruleId: rule.id,
        dueDate,
        expectedAmount: amount,
        actualAmount: saved?.actualAmount,
        status: saved?.status ?? "planned",
        paidDate: saved?.paidDate,
        transactionId: saved?.transactionId,
        paymentMethod: saved?.paymentMethod ?? rule.paymentMethod,
        documentType: saved?.documentType ?? rule.documentType,
        documentRef: saved?.documentRef ?? "",
        note: saved?.note ?? "",
        needsAmount: rule.amountMode === "estimated" && !saved,
        needsReview: Boolean(review && due >= review && !saved),
        overdue: !saved && dueDate < today,
      });
    }
  }

  return projected.sort((a, b) => {
    const dateOrder = a.dueDate.localeCompare(b.dueDate);
    return dateOrder || a.ruleId.localeCompare(b.ruleId);
  });
}

function monthlyEquivalent(rule) {
  const amount = Number(rule.amount || 0);
  const recurrence = normalizeRule(rule);
  if (recurrence.kind === "weekly") return amount * 52.142857 / 12 / recurrence.interval;
  if (recurrence.kind === "yearly") return amount / 12 / recurrence.interval;
  if (recurrence.kind === "once") return 0;
  return amount / recurrence.interval;
}

export function recurringExpenseSummary(rules, occurrences, today) {
  const monthKey = today.slice(0, 7);
  const activeRules = rules.filter((rule) => rule.active);
  const monthlyPlan = activeRules.reduce(
    (sum, rule) => sum + monthlyEquivalent(rule),
    0,
  );
  const thisMonth = occurrences.filter(
    (occurrence) => occurrence.dueDate.slice(0, 7) === monthKey,
  );
  const paid = thisMonth.filter((occurrence) => occurrence.status === "paid");
  const pending = thisMonth.filter(
    (occurrence) => occurrence.status === "planned",
  );

  return {
    activeRuleCount: activeRules.length,
    monthlyPlan: Math.round(monthlyPlan * 100) / 100,
    thisMonthExpected:
      Math.round(
        thisMonth.reduce(
          (sum, occurrence) => sum + occurrence.expectedAmount,
          0,
        ) * 100,
      ) / 100,
    thisMonthPaid:
      Math.round(
        paid.reduce(
          (sum, occurrence) =>
            sum + Number(occurrence.actualAmount ?? occurrence.expectedAmount),
          0,
        ) * 100,
      ) / 100,
    pendingCount: pending.length,
    overdueCount: pending.filter((occurrence) => occurrence.dueDate < today).length,
  };
}

export function recurringCalendarEvents(rules, savedOccurrences, today) {
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  return projectRecurringExpenses(rules, savedOccurrences, today, {
    monthsAhead: 24,
    monthsBack: 2,
  })
    .filter((occurrence) => occurrence.status !== "skipped")
    .map((occurrence) => {
      const rule = ruleMap.get(occurrence.ruleId);
      const paid = occurrence.status === "paid";
      return {
        id: occurrence.id,
        date: paid ? occurrence.paidDate || occurrence.dueDate : occurrence.dueDate,
        title: `${rule?.name ?? "Sabit gider"} · ${paid ? "Ödendi" : occurrence.overdue ? "Gecikti" : "Planlı"}`,
        amount: Number(
          paid
            ? occurrence.actualAmount ?? occurrence.expectedAmount
            : occurrence.expectedAmount,
        ),
        type: paid ? "recurring_payment" : "recurring_expense",
        status: paid
          ? "paid"
          : occurrence.overdue
            ? "overdue"
            : occurrence.needsReview
              ? "review"
              : "planned",
      };
    });
}
