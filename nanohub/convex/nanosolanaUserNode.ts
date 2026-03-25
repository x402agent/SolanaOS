'use node'

import { webcrypto } from 'node:crypto'
import { v } from 'convex/values'
import { internalAction } from './functions'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const subtle = globalThis.crypto?.subtle ?? webcrypto.subtle

function decodeBase58(input: string): Uint8Array {
  const source = input.trim()
  if (!source) throw new Error('Missing base58 value')
  const bytes = [0]
  for (const char of source) {
    const value = BASE58_ALPHABET.indexOf(char)
    if (value < 0) throw new Error('Invalid base58 value')
    let carry = value
    for (let index = 0; index < bytes.length; index += 1) {
      const next = bytes[index]! * 58 + carry
      bytes[index] = next & 0xff
      carry = next >> 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  let leadingZeros = 0
  for (const char of source) {
    if (char !== '1') break
    leadingZeros += 1
  }
  const output = new Uint8Array(leadingZeros + bytes.length)
  for (let index = 0; index < bytes.length; index += 1) {
    output[output.length - 1 - index] = bytes[index]!
  }
  return output
}

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.replace(/\s+/g, ' ').slice(0, 64)
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function buildWalletAuthMessage(args: {
  walletAddress: string
  displayName?: string | null
  appVersion: string
  signedAtMs: number
  nonce: string
}) {
  return [
    'SolanaOS Convex Auth',
    `wallet=${args.walletAddress.trim()}`,
    `display_name=${normalizeDisplayName(args.displayName)}`,
    `app_version=${args.appVersion.trim()}`,
    `signed_at_ms=${args.signedAtMs}`,
    `nonce=${args.nonce.trim()}`,
  ].join('\n')
}

export const verifyWalletAuthInternal = internalAction({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    appVersion: v.string(),
    signedAtMs: v.number(),
    nonce: v.string(),
    signatureBase58: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const publicKey = decodeBase58(args.walletAddress)
      const signature = decodeBase58(args.signatureBase58)
      if (publicKey.length !== 32) {
        return { ok: false, error: 'wallet address is not a valid Ed25519 public key' }
      }
      if (signature.length !== 64) {
        return { ok: false, error: 'detached signature must be 64 bytes' }
      }
      const message = new TextEncoder().encode(buildWalletAuthMessage(args))
      const key = await subtle.importKey('raw', toArrayBuffer(publicKey), 'Ed25519', false, ['verify'])
      const verified =
        await subtle.verify('Ed25519', key, toArrayBuffer(signature), toArrayBuffer(message))
      return { ok: verified, error: verified ? null : 'invalid signature' }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'wallet verification failed',
      }
    }
  },
})
