// ~~/src/types/LNDKrubRouteFunc.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { NextFunction, Response } from 'express'

// define type
export type LNDKrubRouteFunc = (
  request: LNDKrubRequest,
  response: Response,
  next?: NextFunction
) => Promise<Response | void>

export default LNDKrubRouteFunc
