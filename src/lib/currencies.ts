// Currencies covered by the Frankfurter FX source (ECB), plus a few common ones.
export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "JPY",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "SGD",
  "HKD",
  "MXN",
  "BRL",
  "ZAR",
  "INR",
] as const;

export const NET_TERMS = [
  { value: 0, label: "Due on receipt" },
  { value: 7, label: "Net 7" },
  { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" },
  { value: 45, label: "Net 45" },
  { value: 60, label: "Net 60" },
];
