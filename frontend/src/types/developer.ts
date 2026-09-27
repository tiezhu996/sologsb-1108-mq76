export type DeveloperCategory = 'D-76' | 'HC-110' | 'Rodinal' | 'C-41'
export type Dilution = '1:1' | '1:3'
export type DeveloperState = '新配' | '在用' | '报废'
export type DeveloperProcess = 'blackwhite' | 'color'

export interface Developer {
  id?: number
  name: string
  category: DeveloperCategory
  /** 药水工艺：黑白药 / 彩色套药，必须与胶片工艺一致 */
  process?: DeveloperProcess
  dilution: Dilution
  volumeMl: number
  mixedAt: string
  maxRolls: number
  usedRolls: number
  state: DeveloperState
  schemaRev?: number
}
