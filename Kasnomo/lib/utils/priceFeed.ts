/**
 * Pyth Network Price Feed Service
 * Fetches real-time crypto price data from Pyth Network
 * Supports: BTC, SUI, SOL
 */

import { HermesClient } from '@pythnetwork/hermes-client';

// Pyth Network Price Feed IDs (Stable/Mainnet)
export const PRICE_FEED_IDS = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  SUI: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  TRX: '0x67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b',
  XRP: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  XLM: '0xb7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850',
  // Metals
  GOLD: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  SILVER: '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
  // FX
  EUR: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  GBP: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
  JPY: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
  AUD: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80',
  CAD: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b9a214c58cc0eaa2ecca',
  // Stocks
  AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  GOOGL: '0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
  AMZN: '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  MSFT: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  NVDA: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  TSLA: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  META: '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  NFLX: '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',
  KAS: 'kaspa-coingecko-id', // Special ID to trigger CoinGecko fallback
} as const;

export type AssetType = keyof typeof PRICE_FEED_IDS;


// Pyth Hermes API endpoint (public, free to use)
const HERMES_ENDPOINT = 'https://hermes.pyth.network';

export interface PriceData {
  price: number;
  confidence: number;
  timestamp: number;
  expo: number;
}

export class PythPriceFeed {
  private client: HermesClient;
  private intervalId: NodeJS.Timeout | null = null;
  private lastPrice: number | null = null;
  private isRunning: boolean = false;
  private asset: AssetType;

  constructor(asset: AssetType = 'BTC') {
    this.client = new HermesClient(HERMES_ENDPOINT);
    this.asset = asset;
  }

  /**
   * Fetch current price from Pyth Network or CoinGecko (for KAS)
   */
  async fetchPrice(): Promise<PriceData> {
    // Detect KAS asset and divert to CoinGecko
    if (this.asset === 'KAS') {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd&include_last_updated_at=true');

        if (!response.ok) {
          throw new Error(`CoinGecko error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.kaspa || !data.kaspa.usd) {
          throw new Error('No price data received from CoinGecko');
        }

        const price = data.kaspa.usd;
        const timestamp = data.kaspa.last_updated_at;

        this.lastPrice = price;

        return {
          price,
          confidence: 0, // CoinGecko doesn't provide confidence intervals
          timestamp,
          expo: -8
        };
      } catch (error) {
        console.warn(`Error fetching KAS price from CoinGecko:`, error);

        if (this.lastPrice !== null) {
          return {
            price: this.lastPrice,
            confidence: 0,
            timestamp: Date.now() / 1000,
            expo: -8
          };
        }
        // If critical failure on first load, maybe return a default 0 or throw
        throw error;
      }
    }


    // Default Pyth logic for other assets
    try {
      // Ensure ID has 0x prefix and use ids[] format
      const id = PRICE_FEED_IDS[this.asset].startsWith('0x')
        ? PRICE_FEED_IDS[this.asset]
        : `0x${PRICE_FEED_IDS[this.asset]}`;

      const response = await fetch(`${HERMES_ENDPOINT}/v2/updates/price/latest?ids%5B%5D=${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const priceFeeds = await response.json();

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
        throw new Error('No price data received from Pyth Network');
      }

      const priceFeed = priceFeeds.parsed[0];
      const priceData = priceFeed.price;

      // Pyth prices come with an exponent (e.g., price * 10^expo)
      const price = Number(priceData.price) * Math.pow(10, priceData.expo);
      const confidence = Number(priceData.conf) * Math.pow(10, priceData.expo);

      this.lastPrice = price;

      return {
        price,
        confidence,
        timestamp: Number(priceData.publish_time),
        expo: priceData.expo
      };
    } catch (error) {
      console.error(`Error fetching ${this.asset} price from Pyth Network:`, error);

      // If we have a last known price, return it with a warning
      if (this.lastPrice !== null) {
        console.warn('Using last known price due to fetch error');
        return {
          price: this.lastPrice,
          confidence: 0,
          timestamp: Date.now() / 1000,
          expo: -8
        };
      }

      throw error;
    }
  }

  /**
   * Change the asset being tracked
   */
  setAsset(asset: AssetType): void {
    this.asset = asset;
    this.lastPrice = null; // Reset last price when changing asset
  }

  /**
   * Get current asset
   */
  getAsset(): AssetType {
    return this.asset;
  }

  /**
   * Start the price feed
   * Fetches new prices every second and calls the callback
   */
  async start(callback: (price: number, data: PriceData) => void): Promise<void> {
    if (this.isRunning) {
      console.warn('Price feed already running');
      return;
    }

    this.isRunning = true;

    // Fetch initial price
    try {
      const priceData = await this.fetchPrice();
      callback(priceData.price, priceData);
    } catch (error) {
      console.error('Failed to fetch initial price:', error);
    }

    // Update every second
    this.intervalId = setInterval(async () => {
      try {
        const priceData = await this.fetchPrice();
        callback(priceData.price, priceData);
      } catch (error) {
        console.error('Failed to fetch price update:', error);
      }
    }, 1000);
  }

  /**
   * Stop the price feed
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Fetch multiple prices at once
   */
  static async fetchAllPrices(): Promise<Record<AssetType, number>> {
    const validEntries = Object.entries(PRICE_FEED_IDS).filter(([_, id]) => id.startsWith('0x'));
    const ids = validEntries.map(([_, id]) => id);
    // const symbols = validEntries.map(([symbol, _]) => symbol as AssetType); // Use this if index matching required

    try {
      if (ids.length === 0) return {} as Record<AssetType, number>;
      const queryString = ids.map(id => `ids%5B%5D=${id}`).join('&');
      const response = await fetch(`${HERMES_ENDPOINT}/v2/updates/price/latest?${queryString}`);

      if (!response.ok) {
        const bodyText = await response.text();
        console.error(`Pyth API Error (${response.status}): ${bodyText}`);

        // If some IDs are missing, try to fetch them one by one or just return what we have
        if (response.status === 404) {
          console.warn('Handling 404 by returning empty results. Check PRICE_FEED_IDS for invalid entries.');
          return {} as Record<AssetType, number>;
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${bodyText}`);
      }

      const priceFeeds = await response.json();

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
        return {} as Record<AssetType, number>;
      }

      const symbols = validEntries.map(([symbol, _]) => symbol as AssetType);

      const results: any = {};
      priceFeeds.parsed.forEach((feed: any) => {
        // Result ID from Hermes v2 usually doesn't have 0x, but our constant does
        const symbol = symbols.find(s => PRICE_FEED_IDS[s].replace('0x', '') === feed.id);
        if (symbol) {
          const price = Number(feed.price.price) * Math.pow(10, feed.price.expo);
          results[symbol] = price;
        }
      });

      return results;
    } catch (error) {
      console.error('Error in fetchAllPrices:', error);
      return {} as Record<AssetType, number>;
    }
  }

  /**
   * Get the last fetched price (useful for synchronous access)
   */
  getLastPrice(): number | null {
    return this.lastPrice;
  }
}

/**
 * Start a multi-asset price feed
 */
export const startMultiPythPriceFeed = (
  callback: (prices: Record<AssetType, number>) => void
): (() => void) => {
  let intervalId: NodeJS.Timeout | null = null;

  let lastKasFetchTime = 0;
  let cachedKasPrice: number | null = null;

  const update = async () => {
    try {
      // 1. Fetch Pyth prices
      const prices = await PythPriceFeed.fetchAllPrices();

      // 2. Fetch KAS price (CoinGecko) separately (Throttled to 30s)
      try {
        if (Date.now() - lastKasFetchTime > 30000) {
          const kasData = await fetchPrice('KAS');
          if (kasData && kasData.price) {
            cachedKasPrice = kasData.price;
            lastKasFetchTime = Date.now();
          }
        }

        if (cachedKasPrice !== null) {
          prices['KAS'] = cachedKasPrice;
        }
      } catch (kasError) {
        // Silent fail for KAS to not disrupt other feeds
        // console.warn('KAS price fetch failed in multi-feed', kasError);
      }

      callback(prices);
    } catch (err) {
      console.error('Multi-price feed update failed:', err);
    }
  };

  update();
  intervalId = setInterval(update, 1000);

  return () => {
    if (intervalId) clearInterval(intervalId);
  };
};


/**
 * Create and start a Pyth price feed
 * Returns a function to stop the feed
 */
export const startPythPriceFeed = (
  callback: (price: number, data: PriceData) => void,
  asset: AssetType = 'BTC'
): (() => void) => {
  const feed = new PythPriceFeed(asset);

  feed.start(callback);

  return () => feed.stop();
};

/**
 * Fetch a single price snapshot from Pyth Network
 * Useful for one-time price checks
 */
export const fetchPrice = async (asset: AssetType = 'BTC'): Promise<PriceData> => {
  const feed = new PythPriceFeed(asset);
  return await feed.fetchPrice();
};

// Backward compatibility
export const fetchBTCPrice = async (): Promise<PriceData> => {
  return fetchPrice('BTC');
};

// Export for backward compatibility (mock mode for testing)
export class MockPriceFeed {
  private basePrice: number;
  private volatility: number;
  private trend: number;
  private intervalId: NodeJS.Timeout | null = null;
  private asset: AssetType;

  constructor(
    asset: AssetType = 'BTC',
    basePrice?: number,
    volatility: number = 0.001,
    trend: number = 0
  ) {
    this.asset = asset;
    // Default base prices for different assets
    const defaultPrices = {
      BTC: 50000
    };
    this.basePrice = basePrice || defaultPrices[asset as keyof typeof defaultPrices] || 1;
    this.volatility = volatility;
    this.trend = trend;
  }

  setAsset(asset: AssetType): void {
    this.asset = asset;
    const defaultPrices = {
      BTC: 50000
    };
    this.basePrice = defaultPrices[asset as keyof typeof defaultPrices] || 1;
  }

  getAsset(): AssetType {
    return this.asset;
  }

  private generateNextPrice(currentPrice: number): number {
    const randomChange = (Math.random() - 0.5) * 2;
    const change = currentPrice * this.volatility * randomChange + this.trend;

    if (Math.random() < 0.05) {
      const spike = currentPrice * (Math.random() - 0.5) * 0.01;
      return currentPrice + change + spike;
    }

    return currentPrice + change;
  }

  start(callback: (price: number) => void): void {
    if (this.intervalId) {
      console.warn('Price feed already running');
      return;
    }

    let currentPrice = this.basePrice;
    callback(currentPrice);

    this.intervalId = setInterval(() => {
      currentPrice = this.generateNextPrice(currentPrice);
      currentPrice = Math.max(10000, Math.min(100000, currentPrice));
      callback(currentPrice);
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const startMockPriceFeed = (
  callback: (price: number) => void,
  options?: {
    asset?: AssetType;
    basePrice?: number;
    volatility?: number;
    trend?: number;
  }
): (() => void) => {
  const feed = new MockPriceFeed(
    options?.asset || 'BTC',
    options?.basePrice,
    options?.volatility,
    options?.trend
  );

  feed.start(callback);

  return () => feed.stop();
};
