// ~~/src/types/Tag.ts

// imports
import type { TagData } from 'bolt11'

// define type
export type Tag = {
  tagName: string
  data: TagData
}

export default Tag
