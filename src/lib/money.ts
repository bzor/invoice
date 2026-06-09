import type { DiscountType, LineItem } from "@/lib/types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

type TotalsInput = {
  lineItems: Pick<LineItem, "quantity" | "unit_price">[];
  discountType: DiscountType;
  discountValue: number;
};

export function computeTotals({
  lineItems,
  discountType,
  discountValue,
}: TotalsInput) {
  const subtotal = round2(
    lineItems.reduce(
      (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
      0,
    ),
  );
  const discount_total =
    discountType === "percent"
      ? round2((subtotal * (Number(discountValue) || 0)) / 100)
      : round2(Number(discountValue) || 0);
  const total = round2(Math.max(0, subtotal - discount_total));
  return { subtotal, discount_total, total };
}

export function lineTotal(quantity: number, unitPrice: number): number {
  return round2((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

/** Convert a document total into the base currency using its snapshotted rate. */
export function toBase(total: number, fxRate: number): number {
  return round2(total * (Number(fxRate) || 1));
}
