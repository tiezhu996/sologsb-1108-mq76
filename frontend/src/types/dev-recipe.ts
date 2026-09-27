import type { Dilution } from './developer'
import type { RecipeProcess } from './process'

export type PushPull = '-1' | 'N' | '+1' | '+2'

export interface DevRecipe {
  id?: number
  filmId: number
  developerId: number
  dilution: Dilution
  tempC: number
  devMinutes: number
  agitation: string
  stopBath: string
  fixer: string
  washMinutes: number
  pushPull: PushPull
  /** 配方工艺：黑白/彩色由胶片与显影液共同推出，两头对不上的老配方标记为冲突 */
  process?: RecipeProcess
  note?: string
  schemaRev?: number
}
