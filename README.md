# PumpSwap SDK
# Usage

### Buy token through cli
`
ts-node src/buy-cli.ts --token <ADDRESS_TOKEN> --sol <NUMBER_OF_SOL>
`

### Sell token through cli
`
ts-node src/sell-cli.ts --token <ADDRESS_TOKEN> --percentage <SELL_PERCENTAGE>
`
### buy/sell token on PumpSwap
```typescript
import {buy, sell} from "./pum";
import {wallet_1} from "./constants";
import {PumpSwapSDK} from './pumpswap';
async function main() {
    const mint = "your-pumpfun-token-address";
    const sol_amt = 0.99; // buy 1 SOL worth of token using WSOL
    const sell_percentage = 0.5; // sell 50% of the token
    const pumpswap_sdk = new PumpSwapSDK();
    await pumpswap_sdk.buy(new PublicKey(mint), wallet_1.publicKey, sol_amt); // 0.99 sol
    await pumpswap_sdk.sell_percentage(new PublicKey(mint), wallet_1.publicKey, sell_percentage);
    await pumpswap_sdk.sell_exactAmount(new PublicKey(mint), wallet_1.publicKey, 1000); // 1000 token
}
```

### Fetch the price from PumpSwap pool
```typescript

```

### Fetch the pool address for the target token
```typescript

```



