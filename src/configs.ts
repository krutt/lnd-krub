// ~~/src/configs.ts

export const enableUpdateDescribeGraph = false
export const forwardReserveFee = 0.01 // default 0.01
export const intraHubFee = 0.003 // default to 0.003
export const lnd = { password: '', url: 'localhost:10001' }
export const postRateLimit = 100
export const rateLimit = 200
export const redis = { port: 6379, host: 'localhost', family: 4, db: 0 }
export const sunset = false

export default {
  enableUpdateDescribeGraph,
  forwardReserveFee,
  intraHubFee,
  lnd,
  postRateLimit,
  rateLimit,
  redis,
  sunset,
}
