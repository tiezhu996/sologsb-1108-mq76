import type { Developer, DeveloperCategory, DeveloperProcess } from '../types/developer'
import type { FilmModel, FilmProcess, FilmStock } from '../types/film-stock'
import type { DevRecipe } from '../types/dev-recipe'

/** 工艺基准温度：黑白 20°C，彩色 38°C */
export const PROCESS_BASELINE_TEMP: Record<FilmProcess, number> = {
  blackwhite: 20,
  color: 38
}

export const PROCESS_LABEL: Record<FilmProcess, string> = {
  blackwhite: '黑白工艺',
  color: '彩色工艺'
}

/** 型号 → 胶片工艺 */
const FILM_MODEL_PROCESS: Record<FilmModel, FilmProcess> = {
  GP3: 'blackwhite',
  HP5: 'blackwhite',
  Portra: 'color'
}

/** 药水类别 → 药水工艺 */
const DEVELOPER_CATEGORY_PROCESS: Record<DeveloperCategory, DeveloperProcess> = {
  'D-76': 'blackwhite',
  'HC-110': 'blackwhite',
  Rodinal: 'blackwhite',
  'C-41': 'color'
}

export function filmProcessOf(model: FilmModel): FilmProcess {
  return FILM_MODEL_PROCESS[model]
}

export function developerProcessOf(category: DeveloperCategory): DeveloperProcess {
  return DEVELOPER_CATEGORY_PROCESS[category]
}

export function filmStockProcess(film: Pick<FilmStock, 'model' | 'process'>): FilmProcess {
  return film.process ?? filmProcessOf(film.model)
}

export function developerKindProcess(developer: Pick<Developer, 'category' | 'process'>): DeveloperProcess {
  return developer.process ?? developerProcessOf(developer.category)
}

export function baselineTempOf(process: FilmProcess): number {
  return PROCESS_BASELINE_TEMP[process]
}

/** 配方与胶片/药水工艺不一致时抛出，消息里说清哪一头对不上 */
export class ProcessMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcessMismatchError'
  }
}

export interface ProcessCheckResult {
  filmProcess: FilmProcess | null
  developerProcess: DeveloperProcess | null
  matched: boolean
  /** 工艺对不上时，说清是胶片这头还是药水那头对不上 */
  reason: string
}

/**
 * 按胶片工艺核对配方：彩色胶片只能配彩色套药，黑白胶片只能配黑白药。
 * 找不到胶片或药水台账时也判为对不上。
 */
export function checkRecipeProcess(
  film: FilmStock | undefined,
  developer: Developer | undefined
): ProcessCheckResult {
  if (!film && !developer) {
    return {
      filmProcess: null,
      developerProcess: null,
      matched: false,
      reason: '胶片与显影液在台账中都找不到，无法核对工艺'
    }
  }
  if (!film) {
    return {
      filmProcess: null,
      developerProcess: developer ? developerKindProcess(developer) : null,
      matched: false,
      reason: `胶片这头对不上：胶片台账里找不到该批次，无法确认它是黑白还是彩色胶片`
    }
  }
  if (!developer) {
    return {
      filmProcess: filmStockProcess(film),
      developerProcess: null,
      matched: false,
      reason: `药水这头对不上：显影液台账里找不到该工作液，无法确认它是黑白药还是彩色套药`
    }
  }

  const filmKind = filmStockProcess(film)
  const developerKind = developerKindProcess(developer)
  if (filmKind === developerKind) {
    return {
      filmProcess: filmKind,
      developerProcess: developerKind,
      matched: true,
      reason: `${PROCESS_LABEL[filmKind]}：${film.model} 与 ${developer.category} 工艺一致`
    }
  }
  return {
    filmProcess: filmKind,
    developerProcess: developerKind,
    matched: false,
    reason: filmKind === 'color'
      ? `胶片这头是彩色胶片（${film.model}，彩色工艺），药水那头却是黑白药（${developer.category}），必须改用 C-41 彩色套药`
      : `药水那头是彩色套药（${developer.category}），胶片这头却是黑白胶片（${film.model}，黑白工艺），必须改用黑白显影液`
  }
}

/**
 * 给老配方补工艺：依据当前胶片与药水台账判定。
 * 胶片已不存在时回退到配方自身的 process 快照。
 */
export function resolveRecipeProcess(
  recipe: Pick<DevRecipe, 'filmId' | 'process'>,
  film: FilmStock | undefined
): FilmProcess | null {
  if (film) return filmStockProcess(film)
  return recipe.process ?? null
}
