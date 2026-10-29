
/*
 GOLD FORECAST AI
 Momentum Forecast V2

 Model eksperimen berasaskan momentum.
 Data sejarah COMEX gold futures.

 Sumber:
 https://goldprice.corgano.com/
*/

function momentumForecast(records, horizon, endIndex) {
  const lookback = 20;

  if (!Array.isArray(records)) {
    throw new Error("Data tidak sah.");
  }

  if (!Number.isInteger(horizon) || horizon < 1) {
    throw new Error("Tempoh ramalan tidak sah.");
  }

  const end = endIndex ?? records.length - 1;

  if (
    !Number.isInteger(end) ||
    end < lookback ||
    end >= records.length
  ) {
    throw new Error("Data momentum tidak mencukupi.");
  }

  const current = records[end].price;
  const previous = records[end - lookback].price;

  if (!(current > 0) || !(previous > 0)) {
    throw new Error("Harga tidak sah.");
  }

  // Purata perubahan log harga setiap hari dagangan.
  const dailyMomentum =
    Math.log(current / previous) / lookback;

  // Had momentum bagi mengurangkan
  // kesan lonjakan luar biasa.
  const cappedMomentum = Math.max(
    -0.01,
    Math.min(0.01, dailyMomentum)
  );

  const predictedPrice =
    current * Math.exp(cappedMomentum * horizon);

  return {
    model: "Momentum Forecast V2",
    lastDate: records[end].date,
    lastPrice: current,
    horizon,
    predictedPrice,
    dailyMomentum: cappedMomentum,
    direction:
      cappedMomentum > 0
        ? "MENAIK"
        : cappedMomentum < 0
          ? "MENURUN"
          : "MENDATAR"
  };
}

function backtestMomentum(records, horizon) {
  const lookback = 20;
  const start = Math.max(30, lookback);

  if (
    !Array.isArray(records) ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    records.length <= start + horizon
  ) {
    throw new Error("Data ujian tidak mencukupi.");
  }

  let totalError = 0;
  let testCount = 0;

  for (
    let i = start;
    i + horizon < records.length;
    i++
  ) {
    // Hanya gunakan data sehingga indeks i.
    const prediction =
      momentumForecast(records, horizon, i);

    const actual = records[i + horizon].price;

    const error =
      Math.abs(actual - prediction.predictedPrice) /
      actual * 100;

    totalError += error;
    testCount++;
  }

  return {
    model: "Momentum Forecast V2",
    horizon,
    testCount,
    mape: totalError / testCount
  };
}
