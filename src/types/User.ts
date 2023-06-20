/* ~~/src/types/User.ts */

export type UserAuth = {
  access_token?: string // bluewallet: compatibility
  accessToken: string
  refresh_token?: string // bluewallet: compatibility
  refreshToken: string
}

export type UserMetadata = {
  accountType: string
  createdAt: string
  partnerId: string
}

export default UserAuth
