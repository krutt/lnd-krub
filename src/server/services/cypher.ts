// ~~/src/server/services/cypher.ts

// imports
import bitcoin, { Transaction } from 'bitcoinjs-lib'
import classify from 'bitcoinjs-lib/src/classify'

const decodeFormat = (tx: Transaction) => ({
  txid: tx.getId(),
  version: tx.version,
  locktime: tx.locktime,
})

const decodeInput = (tx: Transaction) => {
  const result = []
  tx.ins.forEach((input, n) => {
    result.push({
      txid: input.hash.reverse().toString('hex'),
      n: input.index,
      script: bitcoin.script.toASM(input.script),
      sequence: input.sequence,
    })
  })
  return result
}

const decodeOutput = (tx: Transaction, network) => {
  const format = (out, n, network) => {
    const vout = {
      satoshi: out.value,
      value: (1e-8 * out.value).toFixed(8),
      n: n,
      scriptPubKey: {
        asm: bitcoin.script.toASM(out.script),
        hex: out.script.toString('hex'),
        type: classify.output(out.script),
        addresses: [],
      },
    }
    switch (vout.scriptPubKey.type) {
      case 'pubkeyhash':
      case 'scripthash':
        vout.scriptPubKey.addresses.push(bitcoin.address.fromOutputScript(out.script, network))
        break
      case 'witnesspubkeyhash':
      case 'witnessscripthash':
        const data = bitcoin.script.decompile(out.script)[1]
        // @ts-ignore
        vout.scriptPubKey.addresses.push(bitcoin.address.toBech32(data, 0, network.bech32))
        break
    }
    return vout
  }

  const result = []
  tx.outs.forEach((out, n) => {
    result.push(format(out, n, network))
  })
  return result
}

class TxDecoder {
  tx: Transaction
  format: { locktime: number; txid: string; version: number }
  constructor(rawTx, network = bitcoin.networks.bitcoin) {
    this.tx = bitcoin.Transaction.fromHex(rawTx)
    this.format = decodeFormat(this.tx)
    // @ts-ignore
    this.inputs = decodeInput(this.tx)
    // @ts-ignore
    this.outputs = decodeOutput(this.tx, network)
  }

  decode() {
    const result = {}
    const self = this
    Object.keys(self.format).forEach(key => {
      result[key] = self.format[key]
    })
    // @ts-ignore
    result.outputs = self.outputs
    // @ts-ignore
    result.inputs = self.inputs
    return result
  }
}

export const decodeRawHex = (rawTx, network = bitcoin.networks.bitcoin) => {
  return new TxDecoder(rawTx, network).decode()
}

export default decodeRawHex
