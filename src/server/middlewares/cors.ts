/* ~~/src/server/middlewares/cors.ts */

// imports
import type { Handler, NextFunction, Request, Response } from 'express'

// define handler
export const handler: Handler = (_: Request, response: Response, next: NextFunction) => {
  response.header(
    'Access-Control-Allow-Headers',
    'Authorization,Access-Control-Allow-Origin,Content-Type'
  )
  response.header('Access-Control-Allow-Origin', '*')
  response.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT')
  next()
}

export default handler
