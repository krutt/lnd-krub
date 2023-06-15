// ~~/src/server/services/cypher.ts

// imports
import { Network, Transaction, address, networks, script } from 'bitcoinjs-lib'
import classify from 'bitcoinjs-lib/src/classify'

// types
type Input = {
  n: number
  script: string
  sequence: number
  txid: string
}

type Output = {
  satoshi: number
  value: string
  n: number
  scriptPubKey: {
    asm: string
    hex: string
    type: string
    addresses: string[]
  }
}

let decodeFormat = (transaction: Transaction) => ({
  txid: transaction.getId(),
  version: transaction.version,
  locktime: transaction.locktime,
})

let decodeInput = (transaction: Transaction): Array<Input> => {
  let result: Input[] = []
  transaction.ins.forEach((input, n) => {
    result.push({
      txid: input.hash.reverse().toString('hex'),
      n: input.index,
      script: script.toASM(input.script),
      sequence: input.sequence,
    })
  })
  return result
}

let decodeOutput = (network: Network, transaction: Transaction): Array<Output> => {
  let format = (out, n, network) => {
    let vout = {
      satoshi: out.value,
      value: (1e-8 * out.value).toFixed(8),
      n: n,
      scriptPubKey: {
        asm: script.toASM(out.script),
        hex: out.script.toString('hex'),
        type: classify.output(out.script),
        addresses: [],
      },
    }
    switch (vout.scriptPubKey.type) {
      case 'pubkeyhash':
      case 'scripthash':
        vout.scriptPubKey.addresses.push(address.fromOutputScript(out.script, network))
        break
      case 'witnesspubkeyhash':
      case 'witnessscripthash':
        const data = script.decompile(out.script)[1]
        // @ts-ignore
        vout.scriptPubKey.addresses.push(address.toBech32(data, 0, network.bech32))
        break
    }
    return vout
  }
  let result: Output[] = []
  transaction.outs.forEach((out, n) => {
    result.push(format(out, n, network))
  })
  return result
}

export const decodeRawHex = (rawTransaction: string) => {
  let transaction = Transaction.fromHex(rawTransaction)
  let format = decodeFormat(transaction)
  let result = {}
  Object.keys(format).forEach(key => (result[key] = format[key]))
  let inputs: Input[] = decodeInput(transaction)
  let outputs: Output[] = decodeOutput(networks.bitcoin, transaction)
  return { inputs, outputs, ...result }
}

export default decodeRawHex
