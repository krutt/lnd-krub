/* ~~/src/types/nostr/Kind.ts */

export enum Kind {
  Metadata = 0,
  Text = 1,
  RecommendRelay = 2,
  Contacts = 3,
  EncryptedDirectMessage = 4,
  EventDeletion = 5,
  Repost = 6,
  Reaction = 7,
  BadgeAward = 8,
  ChannelCreation = 40,
  ChannelMetadata = 41,
  ChannelMessage = 42,
  ChannelHideMessage = 43,
  ChannelMuteUser = 44,
  Blank = 255,
  Report = 1984,
  ZapRequest = 9734,
  Zap = 9735,
  RelayList = 10002,
  ClientAuth = 22242,
  NwcRequest = 23194,
  HttpAuth = 27235,
  ProfileBadge = 30008,
  BadgeDefinition = 30009,
  Article = 30023,
  FileMetadata = 1063,
}

export default Kind
