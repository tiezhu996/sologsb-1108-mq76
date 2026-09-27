export type FilmModel = 'GP3' | 'HP5' | 'Portra'
export type FilmFormat = '135' | '120' | '4×5'
export type FilmProcess = 'blackwhite' | 'color'

export interface FilmStock {
  id?: number
  model: FilmModel
  format: FilmFormat
  /** 胶片工艺：黑白 / 彩色，决定可用药水与基准温度 */
  process?: FilmProcess
  boxIso: number
  realIso: number
  emulsionNo: string
  expireDate: string
  rollsLeft: number
  schemaRev?: number
}
