import { daysUntil, roundMoney } from "./finance.mjs";
import {
  expectedPosNet,
  hasCashEffect,
  hasEconomicEffect,
  resolvedPosNet,
} from "./financial-core.mjs";

const MONEY_EPSILON = 0.005;

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} sonlu bir sayı olmalıdır.`);
  }
}

function assertNonNegative(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new RangeError(`${label} negatif olamaz.`);
  }
}

function assertRate(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0 || value >= 1) {
    throw new RangeError(`${label} 0 ile 1 arasında olmalıdır.`);
  }
}

function emptyChannelTotals() {
  return { cash: 0, card: 0, transfer: 0, accrual: 0 };
}

function roundObjectValues(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, amount]) => [key, roundMoney(amount)]),
  );
}

function isAutomaticPosExpense(transaction) {
  return Boolean(
    transaction.kind === "expense" &&
      transaction.operationType === "pos_commission" &&
      transaction.isAutomatic &&
      transaction.sourceTransactionId,
  );
}

export function isDocumentedOutflow(transaction) {
  if (transaction.kind !== "expense" || transaction.status === "cancelled") {
    return false;
  }
  if (isAutomaticPosExpense(transaction)) return true;
  return Boolean(
    transaction.documentType &&
      transaction.documentType !== "none" &&
      String(transaction.documentRef ?? "").trim(),
  );
}

export function isRecognizedExpense(transaction) {
  if (
    transaction.kind !== "expense" ||
    transaction.status === "cancelled" ||
    !hasEconomicEffect(transaction)
  ) {
    return false;
  }
  if (isAutomaticPosExpense(transaction)) {
    return true;
  }
  return isDocumentedOutflow(transaction);
}

export function createPosCommissionExpense(transaction) {
  if (
    transaction.kind !== "income" ||
    transaction.status === "cancelled" ||
    transaction.paymentMethod !== "card"
  ) {
    return null;
  }

  const amount = Number(transaction.amount);
  const posRate = Number(transaction.posRate ?? 0);
  assertNonNegative(amount, "Kart satış tutarı");
  assertRate(posRate, "POS oranı");
  const commission = roundMoney(amount * posRate);
  if (commission <= MONEY_EPSILON) return null;

  return {
    id: `${transaction.id}-pos-fee`,
    date: transaction.date,
    time: transaction.time,
    kind: "expense",
    category: "POS / banka komisyonu",
    description: `Otomatik POS komisyonu · ${transaction.description}`,
    counterparty: transaction.counterparty || "POS sağlayıcısı",
    operationType: "pos_commission",
    costBehavior: "variable",
    relatedIncomeId: transaction.id,
    amount: commission,
    paymentMethod: "accrual",
    documentType: "pos_statement",
    documentRef: `POS-${transaction.documentRef || transaction.id}`,
    vatRate: 0,
    posRate: 0,
    postingMode: "economic_only",
    sourceModule: "pos",
    sourceRecordId: transaction.id,
    isAutomatic: true,
    sourceTransactionId: transaction.id,
  };
}

export function dailyOperationsSummary({
  transactions,
  date,
  openingCash = 0,
  countedCash = null,
}) {
  assertNonNegative(openingCash, "Açılış kasası");
  if (countedCash !== null) {
    assertNonNegative(countedCash, "Sayılan kasa");
  }

  const incomeByChannel = emptyChannelTotals();
  const expenseByChannel = emptyChannelTotals();
  const undocumentedByChannel = emptyChannelTotals();
  const cashInByChannel = emptyChannelTotals();
  const cashOutByChannel = emptyChannelTotals();
  let income = 0;
  let expense = 0;
  let undocumentedOutflow = 0;
  let automaticPosExpense = 0;
  let withdrawals = 0;
  let outputVat = 0;
  let deductibleInputVat = 0;
  let posGross = 0;
  let posFees = 0;
  let posPending = 0;
  let transactionCount = 0;
  let directExpenseCount = 0;
  let documentedExpenseCount = 0;
  let collectionCash = 0;
  let liabilityPaymentCash = 0;
  let assetPurchaseCash = 0;

  for (const transaction of transactions) {
    if (
      transaction.status !== "cancelled" &&
      transaction.kind === "income" &&
      hasCashEffect(transaction) &&
      transaction.paymentMethod === "card" &&
      transaction.posStatus === "settled" &&
      transaction.settlementDate === date
    ) {
      cashInByChannel.card += resolvedPosNet(transaction);
    }
  }

  for (const transaction of transactions) {
    if (transaction.status === "cancelled" || transaction.date !== date) {
      continue;
    }

    const amount = Number(transaction.amount);
    const vatRate = Number(transaction.vatRate ?? 0);
    const posRate = Number(transaction.posRate ?? 0);
    assertNonNegative(amount, "İşlem tutarı");
    assertRate(vatRate, "KDV oranı");
    assertRate(posRate, "POS oranı");

    const channel = transaction.paymentMethod;
    if (!["cash", "card", "transfer", "accrual"].includes(channel)) {
      throw new RangeError("Geçersiz ödeme kanalı.");
    }
    if (transaction.kind === "withdrawal" && channel !== "cash") {
      throw new RangeError("Kasa çekimi yalnızca nakit kanaldan yapılabilir.");
    }

    transactionCount += 1;
    const vat = amount - amount / (1 + vatRate);
    const economic = hasEconomicEffect(transaction);
    const cash = hasCashEffect(transaction);

    if (transaction.kind === "income") {
      if (economic) {
        income += amount;
        incomeByChannel[channel] += amount;
        outputVat += vat;
      } else if (cash) {
        collectionCash += amount;
      }
      if (cash && channel !== "card") cashInByChannel[channel] += amount;

      if (channel === "card") {
        const fee = amount * posRate;
        if (economic) {
          posGross += amount;
          posFees += fee;
        }
        if (transaction.posStatus !== "settled") {
          posPending += expectedPosNet(transaction);
        }
      }
    } else if (transaction.kind === "expense") {
      const automaticPos = isAutomaticPosExpense(transaction);
      if (economic) {
        if (automaticPos) {
          automaticPosExpense += amount;
        } else {
          directExpenseCount += 1;
        }

        if (isRecognizedExpense(transaction)) {
          expense += amount;
          expenseByChannel[channel] += amount;
          deductibleInputVat += vat;
          if (!automaticPos) documentedExpenseCount += 1;
        } else {
          undocumentedOutflow += amount;
          undocumentedByChannel[channel] += amount;
        }
      } else if (cash) {
        if (transaction.operationType === "inventory_purchase") {
          assetPurchaseCash += amount;
          if (isDocumentedOutflow(transaction)) deductibleInputVat += vat;
        } else {
          liabilityPaymentCash += amount;
        }
      }
      if (cash && !automaticPos) cashOutByChannel[channel] += amount;
    } else if (transaction.kind === "withdrawal") {
      withdrawals += amount;
      if (cash) cashOutByChannel[channel] += amount;
    } else {
      throw new RangeError("Geçersiz işlem türü.");
    }
  }

  const expectedCash =
    openingCash +
    cashInByChannel.cash -
    cashOutByChannel.cash;
  const cashInflow = Object.values(cashInByChannel).reduce(
    (sum, value) => sum + value,
    0,
  );
  const cashOutflow = Object.values(cashOutByChannel).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    date,
    transactionCount,
    income: roundMoney(income),
    expense: roundMoney(expense),
    undocumentedOutflow: roundMoney(undocumentedOutflow),
    automaticPosExpense: roundMoney(automaticPosExpense),
    withdrawals: roundMoney(withdrawals),
    collectionCash: roundMoney(collectionCash),
    liabilityPaymentCash: roundMoney(liabilityPaymentCash),
    assetPurchaseCash: roundMoney(assetPurchaseCash),
    operatingBalance: roundMoney(income - expense),
    cashFlowBalance: roundMoney(cashInflow - cashOutflow),
    incomeByChannel: roundObjectValues(incomeByChannel),
    expenseByChannel: roundObjectValues(expenseByChannel),
    undocumentedByChannel: roundObjectValues(undocumentedByChannel),
    cashInByChannel: roundObjectValues(cashInByChannel),
    cashOutByChannel: roundObjectValues(cashOutByChannel),
    directExpenseCount,
    documentedExpenseCount,
    documentCoverage:
      directExpenseCount > 0
        ? documentedExpenseCount / directExpenseCount
        : null,
    openingCash: roundMoney(openingCash),
    expectedCash: roundMoney(expectedCash),
    countedCash: countedCash === null ? null : roundMoney(countedCash),
    cashDifference:
      countedCash === null ? null : roundMoney(countedCash - expectedCash),
    posGross: roundMoney(posGross),
    posFees: roundMoney(posFees),
    posNet: roundMoney(posGross - posFees),
    posPending: roundMoney(posPending),
    outputVat: roundMoney(outputVat),
    deductibleInputVat: roundMoney(deductibleInputVat),
  };
}

function inDateRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

function incrementAmount(target, key, amount) {
  target[key] = (target[key] ?? 0) + amount;
}

export function operationsStatistics({
  transactions,
  startDate,
  endDate,
}) {
  const active = transactions.filter(
    (transaction) =>
      transaction.status !== "cancelled" &&
      inDateRange(transaction.date, startDate, endDate),
  );
  const incomeByCategory = {};
  const expenseByCategory = {};
  const incomeByChannel = emptyChannelTotals();
  const daily = {};
  const incomeIndex = new Map(
    active
      .filter(
        (transaction) =>
          transaction.kind === "income" && hasEconomicEffect(transaction),
      )
      .map((transaction) => [transaction.id, transaction]),
  );
  const revenueDriverMap = {};
  let income = 0;
  let documentedExpense = 0;
  let undocumentedOutflow = 0;
  let withdrawals = 0;
  let posCommission = 0;
  let cardIncome = 0;
  let outputVat = 0;
  let deductibleInputVat = 0;
  let directExpenseCount = 0;
  let documentedExpenseCount = 0;
  let collectionCash = 0;
  let liabilityPaymentCash = 0;
  let assetPurchaseCash = 0;
  let totalCashIn = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.kind === "income" &&
        hasCashEffect(transaction) &&
        transaction.paymentMethod === "card" &&
        transaction.posStatus === "settled" &&
        transaction.settlementDate &&
        inDateRange(transaction.settlementDate, startDate, endDate),
    )
    .reduce((sum, transaction) => sum + resolvedPosNet(transaction), 0);
  let totalCashOut = 0;

  for (const transaction of active) {
    const amount = Number(transaction.amount);
    const vatRate = Number(transaction.vatRate ?? 0);
    assertNonNegative(amount, "İstatistik işlem tutarı");
    assertRate(vatRate, "İstatistik KDV oranı");
    const vat = amount - amount / (1 + vatRate);
    daily[transaction.date] ??= {
      income: 0,
      expense: 0,
      undocumented: 0,
      collection: 0,
      liabilityPayment: 0,
    };
    const economic = hasEconomicEffect(transaction);
    const cash = hasCashEffect(transaction);

    if (transaction.kind === "income") {
      if (
        cash &&
        (transaction.paymentMethod === "cash" ||
          transaction.paymentMethod === "transfer")
      ) {
        totalCashIn += amount;
      }
      if (!economic) {
        collectionCash += amount;
        daily[transaction.date].collection += amount;
        continue;
      }
      income += amount;
      incrementAmount(incomeByCategory, transaction.category, amount);
      incomeByChannel[transaction.paymentMethod] += amount;
      daily[transaction.date].income += amount;
      if (transaction.paymentMethod === "card") cardIncome += amount;
      outputVat += vat;
      const key = `${transaction.operationType || "other_income"}::${transaction.category}`;
      revenueDriverMap[key] ??= {
        operationType: transaction.operationType || "other_income",
        category: transaction.category,
        revenue: 0,
        directCost: 0,
        transactionCount: 0,
      };
      revenueDriverMap[key].revenue += amount;
      revenueDriverMap[key].transactionCount += 1;
    } else if (transaction.kind === "expense") {
      if (cash && !isAutomaticPosExpense(transaction)) totalCashOut += amount;
      if (!economic) {
        if (transaction.operationType === "inventory_purchase") {
          assetPurchaseCash += amount;
          if (isDocumentedOutflow(transaction)) deductibleInputVat += vat;
        } else {
          liabilityPaymentCash += amount;
          daily[transaction.date].liabilityPayment += amount;
        }
        continue;
      }
      if (!isAutomaticPosExpense(transaction)) directExpenseCount += 1;
      if (isRecognizedExpense(transaction)) {
        documentedExpense += amount;
        incrementAmount(expenseByCategory, transaction.category, amount);
        daily[transaction.date].expense += amount;
        deductibleInputVat += vat;
        if (!isAutomaticPosExpense(transaction)) documentedExpenseCount += 1;
        if (isAutomaticPosExpense(transaction)) {
          posCommission += amount;
        }
        const relatedIncome = incomeIndex.get(
          transaction.relatedIncomeId || transaction.sourceTransactionId,
        );
        if (relatedIncome) {
          const key = `${relatedIncome.operationType || "other_income"}::${relatedIncome.category}`;
          revenueDriverMap[key] ??= {
            operationType: relatedIncome.operationType || "other_income",
            category: relatedIncome.category,
            revenue: 0,
            directCost: 0,
            transactionCount: 0,
          };
          revenueDriverMap[key].directCost += amount;
        }
      } else {
        undocumentedOutflow += amount;
        daily[transaction.date].undocumented += amount;
      }
    } else if (transaction.kind === "withdrawal") {
      withdrawals += amount;
      if (cash) totalCashOut += amount;
    }
  }

  const categoryRows = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({
      category,
      amount: roundMoney(amount),
      share: documentedExpense > 0 ? amount / documentedExpense : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const revenueDrivers = Object.values(revenueDriverMap)
    .map((driver) => ({
      ...driver,
      revenue: roundMoney(driver.revenue),
      directCost: roundMoney(driver.directCost),
      contribution: roundMoney(driver.revenue - driver.directCost),
      contributionRate:
        driver.revenue > MONEY_EPSILON
          ? (driver.revenue - driver.directCost) / driver.revenue
          : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    startDate,
    endDate,
    transactionCount: active.length,
    income: roundMoney(income),
    documentedExpense: roundMoney(documentedExpense),
    undocumentedOutflow: roundMoney(undocumentedOutflow),
    withdrawals: roundMoney(withdrawals),
    collectionCash: roundMoney(collectionCash),
    liabilityPaymentCash: roundMoney(liabilityPaymentCash),
    assetPurchaseCash: roundMoney(assetPurchaseCash),
    operatingBalance: roundMoney(income - documentedExpense),
    cashMovement: roundMoney(totalCashIn - totalCashOut),
    posCommission: roundMoney(posCommission),
    cardIncome: roundMoney(cardIncome),
    effectivePosRate:
      cardIncome > MONEY_EPSILON ? posCommission / cardIncome : null,
    outputVat: roundMoney(outputVat),
    deductibleInputVat: roundMoney(deductibleInputVat),
    preliminaryVatPosition: roundMoney(outputVat - deductibleInputVat),
    directExpenseCount,
    documentedExpenseCount,
    documentCoverage:
      directExpenseCount > 0
        ? documentedExpenseCount / directExpenseCount
        : null,
    incomeByCategory: roundObjectValues(incomeByCategory),
    expenseByCategory: categoryRows,
    revenueDrivers,
    incomeByChannel: roundObjectValues(incomeByChannel),
    daily: Object.entries(daily)
      .map(([date, values]) => ({
        date,
        income: roundMoney(values.income),
        expense: roundMoney(values.expense),
        undocumented: roundMoney(values.undocumented),
        collection: roundMoney(values.collection),
        liabilityPayment: roundMoney(values.liabilityPayment),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function consumableUsageStatistics({
  items,
  movements,
  startDate,
  endDate,
}) {
  return items
    .map((item) => {
      const rows = movements.filter(
        (movement) =>
          movement.itemId === item.id &&
          inDateRange(movement.date, startDate, endDate),
      );
      let purchasedUnits = 0;
      let purchasedPackages = 0;
      let usedUnits = 0;
      let wastedUnits = 0;
      let spent = 0;

      for (const movement of rows) {
        const quantity = Number(movement.quantity ?? 0);
        assertNonNegative(quantity, "Sarf hareket miktarı");
        if (movement.type === "purchase") {
          purchasedUnits += quantity;
          purchasedPackages += Number(
            movement.packageCount ??
              quantity / Number(movement.unitsPerPackage || 1),
          );
          spent += Number(
            movement.totalCost ?? quantity * Number(movement.unitCost ?? 0),
          );
        } else if (movement.type === "usage" || movement.type === "sale") {
          usedUnits += quantity;
        } else if (movement.type === "waste") {
          wastedUnits += quantity;
        }
      }

      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        purchaseUnit: item.purchaseUnit || item.unit,
        unitsPerPackage: Number(item.unitsPerPackage || 1),
        purchasedPackages: roundMoney(purchasedPackages),
        purchasedUnits: roundMoney(purchasedUnits),
        usedUnits: roundMoney(usedUnits),
        wastedUnits: roundMoney(wastedUnits),
        remainingUnits: roundMoney(Number(item.quantity)),
        spent: roundMoney(spent),
        averageUnitCost:
          purchasedUnits > MONEY_EPSILON
            ? roundMoney(spent / purchasedUnits)
            : null,
        movementCount: rows.length,
      };
    })
    .filter((row) => row.movementCount > 0)
    .sort((a, b) => b.spent - a.spent);
}

export function buildActionItems({
  statistics,
  inventory,
  cashDifference,
  targetPosRate,
}) {
  const actions = [];
  const add = (priority, title, detail, action) =>
    actions.push({ priority, title, detail, action });

  if (statistics.undocumentedOutflow > MONEY_EPSILON) {
    add(
      "high",
      "Belgesiz para çıkışı var",
      `${roundMoney(statistics.undocumentedOutflow)} TL gider hesabına alınmadı.`,
      "Fiş/faturayı tamamlayın veya kişisel çekim olarak sınıflandırın.",
    );
  }
  if (
    statistics.effectivePosRate !== null &&
    statistics.effectivePosRate > targetPosRate
  ) {
    add(
      "medium",
      "POS maliyeti hedefin üzerinde",
      `Gerçekleşen oran %${roundMoney(statistics.effectivePosRate * 100)}, hedef %${roundMoney(targetPosRate * 100)}.`,
      "Banka sözleşmesini ve alternatif POS tekliflerini karşılaştırın.",
    );
  }
  if (cashDifference !== null && Math.abs(cashDifference) > MONEY_EPSILON) {
    add(
      "high",
      "Kasa sayımı eşleşmiyor",
      `${roundMoney(Math.abs(cashDifference))} TL fark var.`,
      "Eksik fiş, para üstü ve kasadan çekim kayıtlarını kontrol edin.",
    );
  }
  if (inventory.outCount > 0) {
    add(
      "high",
      "Tükenen stok var",
      `${inventory.outCount} ürün sıfır stokta.`,
      "Hasta hizmetini aksatabilecek ürünleri siparişe dönüştürün.",
    );
  }
  if (inventory.lowCount > 0) {
    add(
      "medium",
      "Minimum stok altında ürün var",
      `${inventory.lowCount} ürün minimum seviyede veya altında.`,
      "Tüketim hızına göre alım listesini gözden geçirin.",
    );
  }

  if (actions.length === 0) {
    add(
      "low",
      "Acil aksiyon görünmüyor",
      "Seçilen dönemde tanımlı eşikleri aşan bulgu yok.",
      "Veri giriş düzenini koruyun ve dönem karşılaştırmasını sürdürün.",
    );
  }

  return actions;
}

export function inventoryItemPosition(item, today, expiryWarningDays = 60) {
  const quantity = Number(item.quantity);
  const minimumQuantity = Number(item.minimumQuantity);
  const unitCost = Number(item.unitCost);
  assertNonNegative(quantity, "Stok miktarı");
  assertNonNegative(minimumQuantity, "Asgari stok");
  assertNonNegative(unitCost, "Birim maliyet");

  const daysToExpiry = item.expiryDate
    ? daysUntil(item.expiryDate, today)
    : null;
  const isOut = quantity <= MONEY_EPSILON;
  const isLow = !isOut && quantity <= minimumQuantity + MONEY_EPSILON;
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
  const isExpiring =
    !isExpired &&
    daysToExpiry !== null &&
    daysToExpiry <= expiryWarningDays;

  let code = "healthy";
  if (isOut) code = "out";
  else if (isExpired) code = "expired";
  else if (isLow) code = "low";
  else if (isExpiring) code = "expiring";

  return {
    code,
    quantity: roundMoney(quantity),
    minimumQuantity: roundMoney(minimumQuantity),
    reorderQuantity: roundMoney(Math.max(0, minimumQuantity - quantity)),
    unitCost: roundMoney(unitCost),
    stockValue: roundMoney(quantity * unitCost),
    daysToExpiry,
    isOut,
    isLow,
    isExpired,
    isExpiring,
  };
}

export function inventorySummary(items, today, expiryWarningDays = 60) {
  const positions = items.map((item) => ({
    item,
    position: inventoryItemPosition(item, today, expiryWarningDays),
  }));

  return {
    itemCount: items.length,
    stockValue: roundMoney(
      positions.reduce((sum, entry) => sum + entry.position.stockValue, 0),
    ),
    alertCount: positions.filter(
      ({ position }) =>
        position.isLow ||
        position.isOut ||
        position.isExpiring ||
        position.isExpired,
    ).length,
    lowCount: positions.filter(
      ({ position }) => position.isLow || position.isOut,
    ).length,
    outCount: positions.filter(({ position }) => position.isOut).length,
    expiringCount: positions.filter(
      ({ position }) => position.isExpiring || position.isExpired,
    ).length,
  };
}

export function applyStockMovement(item, movement) {
  const quantity = Number(item.quantity);
  const movementQuantity = Number(movement.quantity);
  const currentUnitCost = Number(item.unitCost);
  assertNonNegative(quantity, "Mevcut stok");
  assertNonNegative(movementQuantity, "Hareket miktarı");
  assertNonNegative(currentUnitCost, "Birim maliyet");
  if (movementQuantity <= MONEY_EPSILON) {
    throw new RangeError("Hareket miktarı sıfırdan büyük olmalıdır.");
  }

  if (movement.type === "purchase" || movement.type === "return_in") {
    const movementUnitCost = Number(movement.unitCost ?? currentUnitCost);
    assertNonNegative(movementUnitCost, "Alış birim maliyeti");
    const nextQuantity = quantity + movementQuantity;
    const nextUnitCost =
      nextQuantity > 0
        ? (quantity * currentUnitCost +
            movementQuantity * movementUnitCost) /
          nextQuantity
        : currentUnitCost;

    return {
      ...item,
      quantity: roundMoney(nextQuantity),
      unitCost: roundMoney(nextUnitCost),
      lot: movement.lot || item.lot,
      expiryDate: movement.expiryDate || item.expiryDate,
    };
  }

  if (
    movement.type === "usage" ||
    movement.type === "sale" ||
    movement.type === "waste"
  ) {
    if (movementQuantity > quantity + MONEY_EPSILON) {
      throw new RangeError("Çıkış miktarı mevcut stoku aşamaz.");
    }
    return {
      ...item,
      quantity: roundMoney(Math.max(0, quantity - movementQuantity)),
    };
  }

  throw new RangeError("Geçersiz stok hareketi.");
}

export function operationalCalendarEvents(transactions, items, today) {
  const posEvents = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.kind === "income" &&
        transaction.paymentMethod === "card" &&
        transaction.posStatus !== "settled" &&
        transaction.settlementDate,
    )
    .map((transaction) => {
      const fee = transaction.amount * Number(transaction.posRate ?? 0);
      return {
        id: `pos-${transaction.id}`,
        date: transaction.settlementDate,
        title: `POS yatışı · ${transaction.description}`,
        amount: roundMoney(transaction.amount - fee),
        type: "pos_settlement",
        status: "pending",
      };
    });

  const stockEvents = items.flatMap((item) => {
    const position = inventoryItemPosition(item, today);
    const events = [];

    if (position.isLow || position.isOut) {
      events.push({
        id: `stock-low-${item.id}`,
        date: today,
        title: `Stok uyarısı · ${item.name}`,
        amount: position.stockValue,
        type: "stock_alert",
        status: position.isOut ? "out" : "low",
      });
    }

    if (item.expiryDate && item.quantity > 0) {
      events.push({
        id: `stock-expiry-${item.id}`,
        date: item.expiryDate,
        title: `SKT · ${item.name}`,
        amount: position.stockValue,
        type: "stock_expiry",
        status: position.isExpired ? "expired" : "scheduled",
      });
    }

    return events;
  });

  return [...posEvents, ...stockEvents];
}
