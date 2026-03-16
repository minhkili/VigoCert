// lib/shelby.ts
import { ShelbyClient } from '@shelby-protocol/sdk/browser'
import { Network } from '@aptos-labs/ts-sdk'

export const shelbyClient = new ShelbyClient({
  network: Network.TESTNET, // change to MAINNET for production
  apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY,
})
