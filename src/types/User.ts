/* ~~/src/types/User.ts */

export type UserMetadata = {
  accountType: string
  createdAt: string
  partnerId: string
}

export type User = {
  access_token: string
  refresh_token: string
}

export default User
