/* ~~/src/server/stores/route.ts */

// imports
import { Route } from '@/types'
import { lightning } from '@/server/stores'
import { promisify } from 'node:util'

export const queryRoutes = async (
  amount: number,
  destination: string,
  source: string
): Promise<Route[] | void> =>
  await promisify(lightning.queryRoutes)
    .bind(lightning)({
      pub_key: destination,
      use_mission_control: true,
      amt: amount,
      source_pub_key: source,
    })
    .catch(console.error)
