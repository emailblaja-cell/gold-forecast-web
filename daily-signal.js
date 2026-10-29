
/*
 * CRdiQ Gold Signal Intelligence V1
 * Analisis teknikal pendidikan berdasarkan
 * harga penutupan sejarah COMEX.
 *
 * Tidak membuat transaksi atau menjamin
 * pergerakan harga masa hadapan.
 */

(function () {
  "use strict";

  function sma(values, period) {
    if (values.length < period) return null;

    const recent = values.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / period;
  }

  function emaSeries(values, period) {
    if (values.length < period) return [];

    const multiplier = 2 / (period + 1);
    const seed = values.slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    const result = Array(period - 1).fill(null);
    let previous = seed;
    result.push(seed);

    for (let i = period; i < values.length; i++) {
      previous =
        (values[i] - previous) * multiplier + previous;

      result.push(previous);
    }

    return result;
  }

  function rsi(values, period = 14) {
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      avgGain =
        (avgGain * (period - 1) +
          Math.max(change, 0)) / period;

      avgLoss =
        (avgLoss * (period - 1) +
          Math.max(-change, 0)) / period;
    }

    if (avgGain === 0 && avgLoss === 0) return 50;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  function macd(values) {
    const fast = emaSeries(values, 12);
    const slow = emaSeries(values, 26);

    const line = [];

    for (let i = 25; i < values.length; i++) {
      line.push(fast[i] - slow[i]);
    }

    if (line.length < 9) return null;

    const signalSeries = emaSeries(line, 9);
    const macdLine = line.at(-1);
    const signalLine = signalSeries.at(-1);

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  function bollinger(values, period = 20) {
    if (values.length < period) return null;

    const recent = values.slice(-period);
    const mean = sma(values, period);

    const variance = recent.reduce(
      (sum, price) => sum + (price - mean) ** 2,
      0
    ) / period;

    const deviation = Math.sqrt(variance);

    return {
      middle: mean,
      upper: mean + 2 * deviation,
      lower: mean - 2 * deviation
    };
  }

  function atrProxy(values, period = 14) {
    if (values.length <= period) return null;

    // Anggaran turun naik berdasarkan
    // perubahan penutupan sahaja.
    // BUKAN ATR sebenar kerana CSV
    // tidak mengandungi high dan low.
    const changes = [];

    for (let i = 1; i < values.length; i++) {
      changes.push(Math.abs(values[i] - values[i - 1]));
    }

    return sma(changes, period);
  }

  function analyze(records, horizon = 1) {
    const validHorizons = [1, 3, 5, 7];

    if (!validHorizons.includes(horizon)) {
      throw new Error("Tempoh analisis tidak sah.");
    }

    if (!Array.isArray(records) || records.length < 60) {
      throw new Error(
        "Sekurang-kurangnya 60 rekod diperlukan."
      );
    }

    const prices = records.map(row =>
      Number(row.price ?? row.close_usd_per_oz)
    );

    if (prices.some(price =>
      !Number.isFinite(price) || price <= 0
    )) {
      throw new Error("Data harga tidak sah.");
    }

    const latest = prices.at(-1);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const rsi14 = rsi(prices);
    const macdResult = macd(prices);
    const bands = bollinger(prices);
    const volatility = atrProxy(prices);

    const signals = [];

    signals.push({
      name: "Trend SMA",
      direction:
        latest > sma20 && sma20 > sma50 ? 1 :
        latest < sma20 && sma20 < sma50 ? -1 : 0
    });

    signals.push({
      name: "RSI14",
      direction:
        rsi14 > 55 && rsi14 < 70 ? 1 :
        rsi14 < 45 && rsi14 > 30 ? -1 : 0
    });

    signals.push({
      name: "MACD",
      direction:
        macdResult.histogram > 0 ? 1 :
        macdResult.histogram < 0 ? -1 : 0
    });

    signals.push({
      name: "Bollinger Bands",
      direction:
        latest > bands.middle &&
        latest < bands.upper ? 1 :
        latest < bands.middle &&
        latest > bands.lower ? -1 : 0
    });

    const positive =
      signals.filter(item => item.direction === 1).length;

    const negative =
      signals.filter(item => item.direction === -1).length;

    let label = "WAIT";

    if (positive >= 3 && negative === 0) {
      label = "BUY SETUP";
    } else if (negative >= 3 && positive === 0) {
      label = "SELL SETUP";
    } else if (positive >= 2 && negative <= 1) {
      label = "HOLD";
    } else if (negative >= 2 && positive <= 1) {
      label = "WAIT TO BUY";
    }

    return {
      date: records.at(-1).date,
      horizon,
      latest,
      sma20,
      sma50,
      rsi14,
      macd: macdResult,
      bollinger: bands,
      closeVolatilityProxy: volatility,
      positive,
      negative,
      totalIndicators: signals.length,
      signals,
      label,
      disclaimer:
        "Signal teknikal berdasarkan sejarah, " +
        "bukan arahan transaksi atau jaminan harga."
    };
  }

  window.CRdiQDailySignal = {
    analyze
  };
})();
