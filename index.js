const searchInput = document.querySelector("#symbol");
const searchButton = document.querySelector("#search-button");
const symbolList = document.querySelector("#symbol-list");
const amountInput = document.querySelector("#amount");
const dateInput = document.querySelector("#purchase-date");

// Yahoo Finance via RapidAPI
const RAPIDAPI_KEY = "85b7528a0fmsh719d960e575c132p10623fjsn0d5ef66528fb"; // TODO: Replace with your RapidAPI key
//const RAPIDAPI_HOST = 'yahoo-finance127.p.rapidapi.com';
const RAPIDAPI_HOST = "apidojo-yahoo-finance-v1.p.rapidapi.com";

async function fetchYahooCurrentPrice(symbol) {
  const url = `https://${RAPIDAPI_HOST}/market/v2/get-quotes?region=US&symbols=${symbol}`;
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  };
  try {
    const response = await fetch(url, options);
    console.log("HTTP status:", response.status);
    let data;
    try {
      data = await response.json();
      console.log("Yahoo Finance get-quotes response:", data);
    } catch (jsonErr) {
      const rawText = await response.text();
      console.error("Failed to parse JSON. Raw response:", rawText);
      throw jsonErr;
    }
    if (
      data &&
      data.quoteResponse &&
      data.quoteResponse.result &&
      data.quoteResponse.result.length > 0 &&
      data.quoteResponse.result[0].regularMarketPrice !== undefined
    ) {
      return data.quoteResponse.result[0].regularMarketPrice;
    }
    throw new Error("No current price data");
  } catch (err) {
    console.error("Error fetching current price:", err);
    throw err;
  }
}

// Fetch historical price using Yahoo Finance via RapidAPI (apidojo-yahoo-finance-v1.p.rapidapi.com)
async function fetchYahooHistoricalPrice(symbol, date) {
  // date format: YYYY-MM-DD
  const [year, month, day] = date.split("-");
  const from = Math.floor(new Date(date).setHours(0, 0, 0, 0) / 1000);
  const to = Math.floor(new Date(date).setHours(23, 59, 59, 999) / 1000);
  const url = `https://${RAPIDAPI_HOST}/stock/v2/get-chart?interval=1d&symbol=${symbol}&period1=${from}&period2=${to}&region=US`;
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  };
  try {
    const response = await fetch(url, options);
    console.log("Historical price HTTP status:", response.status);
    if (response.status === 204) {
      throw new Error("No historical data for this date (204 No Content)");
    }
    let data;
    try {
      data = await response.json();
      console.log("Yahoo Finance historical response:", data);
    } catch (jsonErr) {
      console.error("Failed to parse JSON for historical data.");
      throw jsonErr;
    }
    if (
      data &&
      data.chart &&
      data.chart.result &&
      data.chart.result.length > 0 &&
      data.chart.result[0].indicators &&
      data.chart.result[0].indicators.quote &&
      data.chart.result[0].indicators.quote.length > 0
    ) {
      const timestamps = data.chart.result[0].timestamp;
      const closes = data.chart.result[0].indicators.quote[0].close;
      if (timestamps && closes) {
        // Find the closest previous trading day
        let found = false;
        let lastClose = null;
        for (let i = 0; i < timestamps.length; i++) {
          const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
          if (d <= date && closes[i] !== null && closes[i] !== undefined) {
            lastClose = closes[i];
            if (d === date) {
              found = true;
              break;
            }
          }
        }
        if (lastClose !== null) {
          return lastClose;
        }
      }
    }
    throw new Error("No historical data for this date or previous trading day");
  } catch (err) {
    console.error("Error fetching historical price:", err);
    throw err;
  }
}

//listen for input changes
searchButton.addEventListener("click", async function () {
  const symbol = searchInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const purchaseDate = dateInput.value;
  if (!symbol || !amount || !purchaseDate) return;

  try {
    // Fetch current price
    const currentPrice = await fetchYahooCurrentPrice(symbol);
    // Fetch historical price
    const historicalPrice = await fetchYahooHistoricalPrice(
      symbol,
      purchaseDate
    );
    if (!historicalPrice) {
      alert(
        "No historical price data found for this symbol and date. Please check your inputs or try a different date."
      );
      return;
    }
    // Calculate shares, current value, % return
    const shares = amount / historicalPrice;
    const currentValue = shares * currentPrice;
    const percentReturn = ((currentValue - amount) / amount) * 100;
    const returnClass =
      percentReturn > 0
        ? "positive"
        : percentReturn < 0
        ? "negative"
        : "neutral";

    // Add to list box if not already present
    const existingOption = Array.from(symbolList.options).find(
      (option) => option.value === symbol
    );
    if (!existingOption) {
      const option = document.createElement("option");
      option.value = symbol;
      option.text = symbol;
      symbolList.appendChild(option);
    }

    const cardContainer = document.getElementById("card-container");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <h3>${symbol}</h3>
            <p class="symbol">${symbol}</p>
            <p class="price">Current Price $${parseFloat(currentPrice).toFixed(
              2
            )}</p>
            <p>Shares: ${shares.toFixed(4)}</p>
            <p>Current Value: $${currentValue.toFixed(2)}</p>
            <p class="change ${returnClass}">% Return: ${percentReturn.toFixed(
      2
    )}%</p>
            <div class="card-buttons">
                <a href="https://finance.yahoo.com/chart/${symbol}" target="_blank" class="chart-button">View Chart</a>
                <button class="delete-button">Delete</button>
            </div>
        `;
    cardContainer.appendChild(card);

    // Clear the input fields after adding
    searchInput.value = "";
    amountInput.value = "";
    dateInput.value = "";
  } catch (error) {
    alert(
      "No price data found for this symbol and date. Please check your inputs or try a different date."
    );
    return;
  }
});

// Add event listener for delete buttons
document
  .getElementById("card-container")
  .addEventListener("click", function (e) {
    if (e.target.classList.contains("delete-button")) {
      const card = e.target.closest(".card");
      const symbol = card.querySelector(".symbol").textContent;

      // Remove from list box
      const option = Array.from(symbolList.options).find(
        (opt) => opt.value === symbol
      );
      if (option) {
        symbolList.removeChild(option);
      }

      // Remove the card
      card.remove();
    }
  });
