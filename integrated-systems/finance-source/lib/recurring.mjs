const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const interval = Number(rule.frequencyMonths);
    if (!Number.isInteger(interval) || interval < 1) {
      throw new RangeError("Tekrar aralığı en az bir ay olmalıdır.");
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
        });
      }
      continue;
    }

    for (let step = 0; step < 600; step += 1) {
      const dueDate = addMonthsAnchored(rule.startDate, step * interval);
      const due = parseDateOnly(dueDate);
      if (due > windowEnd || (end && due > end)) break;
      if (due < start || due < windowStart) continue;

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
      });
    }
  }

  return projected.sort((a, b) => {
    const dateOrder = a.dueDate.localeCompare(b.dueDate);
    return dateOrder || a.ruleId.localeCompare(b.ruleId);
  });
}

export function recurringExpenseSummary(rules, occurrences, today) {
  const monthKey = today.slice(0, 7);
  const activeRules = rules.filter((rule) => rule.active);
  const monthlyPlan = activeRules.reduce(
    (sum, rule) => sum + Number(rule.amount) / Number(rule.frequencyMonths),
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
        title: `${rule?.name ?? "Sabit gider"} · ${paid ? "Ödendi" : "Planlı"}`,
        amount: Number(
          paid
            ? occurrence.actualAmount ?? occurrence.expectedAmount
            : occurrence.expectedAmount,
        ),
        type: paid ? "recurring_payment" : "recurring_expense",
        status: paid
          ? "paid"
          : occurrence.needsReview
            ? "review"
            : "planned",
      };
    });
}
