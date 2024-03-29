// ~/rollup.config.js

// imports
const commonJS = require('@rollup/plugin-commonjs')
const resolve = require('@rollup/plugin-node-resolve')
const typescript = require('@rollup/plugin-typescript')

let plugins = [commonJS(), resolve(), typescript()]

module.exports = {
  type: 'module',
  input: {
    locked: 'src/jobs/locked_payments.ts',
    unpaid: 'src/jobs/unpaid_invoices.ts',
  },
  output: {
    dir: 'cronjobs',
    format: 'cjs',
  },
  plugins,
}
