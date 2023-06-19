/* ~~/src/types/LNDKrubRequest.ts */

// imports
import type { Request } from 'express'

// define type
export type LNDKrubRequest = Request & { uuid: string }

export default LNDKrubRequest
