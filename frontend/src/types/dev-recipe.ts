import type { Dilution } from './developer'
import type { FilmProcess } from './film-stock'

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
  /** 登记时的胶片工艺快照（黑白 / 彩色） */
  process?: FilmProcess
  /** 老配方补工艺后，胶片与药水工艺对不上时置 true */
  processMismatch?: boolean
  note?: string
  schemaRev?: number
}
