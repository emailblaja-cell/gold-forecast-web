
/*
  GOLD FORECAST AI
  Enjin Ramalan Asas V1

  Model: Naive Forecast
  Tujuan: Penanda aras dan ujian ketepatan

  Data:
  Gold price data by Corgano
  https://goldprice.corgano.com/

  COMEX gold futures daily closes.
  Bukan harga spot langsung.
*/

async function loadForecastHistory() {
  const response = await fetch(
    "./data/gold-price-history.csv",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Gagal membaca data sejarah.");
  }

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);

  const headers = lines[0]
    .split(",")
    .map(h => h.trim().toLowerCase());

  const dateIndex = headers.indexOf("date");
  const priceIndex =
    headers.indexOf("close_usd_per_oz");

  if (dateIndex < 0 || priceIndex < 0) {
    throw new Error("Format CSV tidak sepadan.");
  }

  const today = new Date()
    .toISOString().slice(0, 10);

  const records = lines.slice(1)
    .map(line => {
      const cells = line.split(",");

      return {
        date: cells[dateIndex]?.trim(),
        price: Number(cells[priceIndex])
      };
    })
    .filter(row =>
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      row.date <= today &&
      Number.isFinite(row.price) &&
      row.price > 0
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (records.length < 100) {
    throw new Error("Data sejarah tidak mencukupi.");
  }

  return records;
}

function naiveForecast(records, horizon) {
  if (!Array.isArray(records) || records.length < 2) {
    throw new Error("Rekod tidak mencukupi.");
  }

  const latest = records.at(-1);

  return {
    model: "Naive Forecast V1",
    lastDate: latest.date,
    lastPrice: latest.price,
    horizon,
    predictedPrice: latest.price
  };
}

function backtestNaive(records, horizon) {
  if (records.length <= horizon + 30) {
    throw new Error(
      "Data tidak mencukupi untuk ujian."
    );
  }

  const errors = [];

  // Ujian berjalan ke hadapan:
  // Hanya harga yang diketahui pada masa itu
  // digunakan untuk setiap ramalan.
  for (
    let i = 30;
    i + horizon < records.length;
    i++
  ) {
    const predicted = records[i].price;
    const actual = records[i + horizon].price;

    const percentageError =
      Math.abs(actual - predicted) /
      actual * 100;

    errors.push(percentageError);
  }

  const mape =
    errors.reduce((a, b) => a + b, 0) /
    errors.length;

  return {
    horizon,
    testCount: errors.length,
    mape,
    note:
      "MAPE ialah purata ralat peratus mutlak."
  };
}

/*
  GOLD FORECAST AI
  Julat perubahan harga sejarah

  Persentil 10 hingga 90.
  Ini julat empirikal, bukan jaminan.
*/

function historicalForecastRange(records, horizon) {
  if (
    !Array.isArray(records) ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    records.length <= horizon + 30
  ) {
    throw new Error(
      "Data tidak mencukupi untuk julat ramalan."
    );
  }

  const changes = [];

  for (
    let i = 30;
    i + horizon < records.length;
    i++
  ) {
    const startPrice = records[i].price;
    const futurePrice = records[i + horizon].price;

    if (startPrice > 0 && futurePrice > 0) {
      changes.push(
        futurePrice / startPrice - 1
      );
    }
  }

  changes.sort((a, b) => a - b);

  if (changes.length < 30) {
    throw new Error(
      "Sampel perubahan harga tidak mencukupi."
    );
  }

  function percentile(values, p) {
    const position = (values.length - 1) * p;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;

    return values[lower] * (1 - weight) +
      values[upper] * weight;
  }

  const lowerChange = percentile(changes, 0.10);
  const upperChange = percentile(changes, 0.90);

  const latestPrice = records.at(-1).price;

  return {
    horizon,
    sampleCount: changes.length,
    lowerChange,
    upperChange,
    lowerPrice: latestPrice * (1 + lowerChange),
    upperPrice: latestPrice * (1 + upperChange),
    note:
      "Julat persentil 10–90 perubahan harga sejarah."
  };
}
