// ~~/src/server/routes/index.ts

// imports
import type { NextFunction, Request, Response } from 'express'

// types
export type LNDKrubRequest = Request & { uuid: string }
export type LNDKrubRouteFunc = (
  request: LNDKrubRequest,
  response: Response,
  next?: NextFunction
) => Promise<Response | void>
