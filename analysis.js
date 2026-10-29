
/*
  GOLD FORECAST AI
  Modul Analisis Trend V1

  Sumber:
  Gold price data by Corgano
  https://goldprice.corgano.com/

  Data: COMEX gold futures daily close.
  Ini bukan harga spot langsung.
*/

async function analyzeGoldHistory() {
  const response = await fetch(
    "./data/gold-price-history.csv",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Fail sejarah tidak dapat dibaca.");
  }

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);

  if (lines.length < 32) {
    throw new Error("Data sejarah tidak mencukupi.");
  }

  const headers = lines[0]
    .split(",")
    .map(h => h.trim().toLowerCase());

  const dateIndex = headers.indexOf("date");
  const closeIndex = headers.indexOf("close_usd_per_oz");

  if (dateIndex < 0 || closeIndex < 0) {
    throw new Error(
      "CSV mesti mempunyai lajur date dan close."
    );
  }

  const records = lines.slice(1)
    .map(line => {
      const cells = line.split(",");
      return {
        date: cells[dateIndex]?.trim(),
        close: Number(cells[closeIndex])
      };
    })
    .filter(row =>
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      Number.isFinite(row.close) &&
      row.close > 0
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (records.length < 200) {
    throw new Error(
      "Sekurang-kurangnya 200 rekod diperlukan."
    );
  }

  // Elak menggunakan rekod bertarikh masa depan.
  const today = new Date().toISOString().slice(0, 10);
  const validRecords = records.filter(
    row => row.date <= today
  );

  if (validRecords.length < 200) {
    throw new Error("Data sah tidak mencukupi.");
  }

  const prices = validRecords.map(row => row.close);

  function sma(period) {
    const selected = prices.slice(-period);
    return selected.reduce((a, b) => a + b, 0) /
      selected.length;
  }

  const latest = prices[prices.length - 1];
  const sma20 = sma(20);
  const sma50 = sma(50);
  const sma200 = sma(200);

  let trend = "TIDAK PASTI";

  if (latest > sma20 && sma20 > sma50) {
    trend = "TREND MENAIK";
  } else if (latest < sma20 && sma20 < sma50) {
    trend = "TREND MENURUN";
  }

  return {
    date: validRecords.at(-1).date,
    totalRecords: validRecords.length,
    latest,
    sma20,
    sma50,
    sma200,
    trend
  };
}
