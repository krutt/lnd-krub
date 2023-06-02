// ~~/src/server/middlewares/identifiable.ts

// imports
import type { Handler, NextFunction, Response } from 'express'
import type { LNDKrubRequest } from '@/server/routes'
import { v4 as uuid } from 'uuid'

// define handler
export const handler: Handler = (request: LNDKrubRequest, _: Response, next: NextFunction) => {
  request.uuid = uuid()
  next()
}

export default handler
