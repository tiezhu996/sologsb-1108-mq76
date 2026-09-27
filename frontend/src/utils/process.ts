import type { DevRecipe } from '../types/dev-recipe'
import type { Developer, DeveloperCategory } from '../types/developer'
import type { FilmModel, FilmStock } from '../types/film-stock'
import type { FilmProcess, RecipeProcess } from '../types/process'
import { calculateCompensatedMinutes } from '../hooks/useTempCompensate'

/** 工艺基准温度：黑白 20°C，彩色 38°C，配方表与实冲页共用同一口径 */
export const PROCESS_BASELINE_TEMP_C: Record<FilmProcess, number> = {
  黑白: 20,
  彩色: 38
}

const FILM_PROCESS: Record<FilmModel, FilmProcess> = {
  GP3: '黑白',
  HP5: '黑白',
  Portra: '彩色'
}

const DEVELOPER_PROCESS: Record<DeveloperCategory, FilmProcess> = {
  'D-76': '黑白',
  'HC-110': '黑白',
  Rodinal: '黑白',
  'C-41': '彩色'
}

export function filmProcessOf(film?: Pick<FilmStock, 'model'> | null): FilmProcess | null {
  if (!film) return null
  return FILM_PROCESS[film.model] ?? null
}

export function developerProcessOf(developer?: Pick<Developer, 'category'> | null): FilmProcess | null {
  if (!developer) return null
  return DEVELOPER_PROCESS[developer.category] ?? null
}

export interface ProcessResolution {
  process: RecipeProcess
  filmProcess: FilmProcess | null
  developerProcess: FilmProcess | null
  mismatch: boolean
}

/** 按胶片与显影液推出配方工艺；任何一头缺失或两头不一致都判为冲突 */
export function resolveRecipeProcess(
  film?: Pick<FilmStock, 'model'> | null,
  developer?: Pick<Developer, 'category'> | null
): ProcessResolution {
  const filmProcess = filmProcessOf(film)
  const developerProcess = developerProcessOf(developer)
  const mismatch = filmProcess === null || developerProcess === null || filmProcess !== developerProcess
  return {
    process: mismatch ? '冲突' : filmProcess,
    filmProcess,
    developerProcess,
    mismatch
  }
}

/** 配方折算的基准温度：有效工艺取工艺基准（黑白 20 / 彩色 38），否则退回配方自身记录的温度 */
export function baselineTempOfRecipe(recipe: Pick<DevRecipe, 'tempC'> & { process?: RecipeProcess }): number {
  if (recipe.process === '黑白' || recipe.process === '彩色') {
    return PROCESS_BASELINE_TEMP_C[recipe.process]
  }
  return recipe.tempC
}

/**
 * 把配方显影时间折算到目标温度。
 * 配方表与实冲页必须都走这一个函数，保证同一条配方在同一温度下得数一致。
 */
export function compensatedMinutesForRecipe(
  recipe: Pick<DevRecipe, 'devMinutes' | 'tempC'> & { process?: RecipeProcess },
  targetTempC: number
): number {
  return calculateCompensatedMinutes(recipe.devMinutes, targetTempC, baselineTempOfRecipe(recipe))
}

/** 把老配方的时间从原基准温度折算到工艺基准温度（迁移用，不改变物理含义） */
export function normalizeMinutesToBaseline(
  devMinutes: number,
  fromTempC: number,
  process: FilmProcess
): { tempC: number; devMinutes: number } {
  const baseline = PROCESS_BASELINE_TEMP_C[process]
  return {
    tempC: baseline,
    devMinutes: calculateCompensatedMinutes(devMinutes, baseline, fromTempC)
  }
}

/** 选串工艺时的拦截说明，点明胶片与显影液各自属于哪一头 */
export function describeProcessMismatch(
  film: Pick<FilmStock, 'model'> & Partial<FilmStock>,
  developer: Pick<Developer, 'category'> & Partial<Developer>
): string {
  const filmProcess = filmProcessOf(film)
  const developerProcess = developerProcessOf(developer)
  const filmEnd = `胶片「${film.model}」是${filmProcess ?? '未知'}工艺`
  const developerEnd = `显影液「${developer.name ?? developer.category}」是${developerProcess ?? '未知'}工艺`
  const rule = filmProcess === '彩色'
    ? '彩色胶片必须配彩色套药'
    : filmProcess === '黑白'
      ? '黑白胶片必须配黑白显影液'
      : '胶片与显影液必须同属一种工艺'
  return `工艺对不上：${filmEnd}，${developerEnd}。${rule}，请更换其中一头。`
}
