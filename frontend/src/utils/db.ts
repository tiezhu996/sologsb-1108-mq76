import Dexie, { type Table } from 'dexie'
import type { FilmStock } from '../types/film-stock'
import type { Developer } from '../types/developer'
import type { DevRecipe } from '../types/dev-recipe'
import type { DevRun } from '../types/dev-run'
import { checkRecipeProcess, filmStockProcess, developerKindProcess, resolveRecipeProcess } from './process'
export const CURRENT_SCHEMA_REV = 3

export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const filmSeeds: FilmStock[] = [
  { id: 1, model: 'GP3', format: '135', process: 'blackwhite', boxIso: 100, realIso: 100, emulsionNo: 'GP3-2504-A17', expireDate: '2027-08-01', rollsLeft: 12, schemaRev: 3 },
  { id: 2, model: 'HP5', format: '135', process: 'blackwhite', boxIso: 400, realIso: 640, emulsionNo: 'HP5-2509-B31', expireDate: '2026-11-30', rollsLeft: 3, schemaRev: 3 },
  { id: 3, model: 'Portra', format: '120', process: 'color', boxIso: 400, realIso: 320, emulsionNo: 'PC400-147-02', expireDate: '2027-03-18', rollsLeft: 5, schemaRev: 3 },
  { id: 4, model: 'GP3', format: '120', process: 'blackwhite', boxIso: 100, realIso: 100, emulsionNo: 'GP3-2404-C08', expireDate: '2026-10-12', rollsLeft: 2, schemaRev: 3 },
  { id: 5, model: 'HP5', format: '4×5', process: 'blackwhite', boxIso: 400, realIso: 400, emulsionNo: 'HP5-45-24C', expireDate: '2027-01-20', rollsLeft: 8, schemaRev: 3 },
  { id: 6, model: 'Portra', format: '135', process: 'color', boxIso: 400, realIso: 400, emulsionNo: 'PC400-132-01', expireDate: '2025-12-31', rollsLeft: 0, schemaRev: 3 }
]

const developerSeeds: Developer[] = [
  { id: 1, name: '柯达 D-76 工作液 A', category: 'D-76', process: 'blackwhite', dilution: '1:1', volumeMl: 1000, mixedAt: '2026-09-12', maxRolls: 12, usedRolls: 4, state: '在用', schemaRev: 3 },
  { id: 2, name: '伊尔福 HC-110 稀释液', category: 'HC-110', process: 'blackwhite', dilution: '1:3', volumeMl: 1000, mixedAt: '2026-09-16', maxRolls: 16, usedRolls: 8, state: '在用', schemaRev: 3 },
  { id: 3, name: '罗迪纳尔 高稀释工作液', category: 'Rodinal', process: 'blackwhite', dilution: '1:3', volumeMl: 500, mixedAt: '2026-08-28', maxRolls: 10, usedRolls: 10, state: '在用', schemaRev: 3 },
  { id: 4, name: '柯达 C-41 彩色套药', category: 'C-41', process: 'color', dilution: '1:3', volumeMl: 1000, mixedAt: '2026-09-20', maxRolls: 12, usedRolls: 0, state: '新配', schemaRev: 3 },
  { id: 5, name: '旧版 D-76 补充液', category: 'D-76', process: 'blackwhite', dilution: '1:1', volumeMl: 750, mixedAt: '2026-05-10', maxRolls: 10, usedRolls: 10, state: '报废', schemaRev: 3 }
]

const recipeSeeds: DevRecipe[] = [
  { id: 1, filmId: 1, developerId: 1, dilution: '1:1', tempC: 20, devMinutes: 9.5, agitation: '每 30s 摇 5s', stopBath: '酸性停显 1 分钟', fixer: '快速定影 5 分钟', washMinutes: 10, pushPull: 'N', process: 'blackwhite', processMismatch: false, note: '日光下层次稳定', schemaRev: 3 },
  { id: 2, filmId: 2, developerId: 2, dilution: '1:3', tempC: 20, devMinutes: 7.5, agitation: '前 30s 连续，其后每 30s 摇 5s', stopBath: '停显 1 分钟', fixer: '定影 5 分钟', washMinutes: 10, pushPull: '+1', process: 'blackwhite', processMismatch: false, note: '暗部充分，注意高光', schemaRev: 3 },
  { id: 3, filmId: 3, developerId: 4, dilution: '1:3', tempC: 38, devMinutes: 3.25, agitation: '每 30s 翻转 5s', stopBath: 'C-41 停显 1 分钟', fixer: '漂定 6.5 分钟', washMinutes: 6, pushPull: 'N', process: 'color', processMismatch: false, note: '严格维持 38°C', schemaRev: 3 },
  { id: 4, filmId: 4, developerId: 3, dilution: '1:3', tempC: 20, devMinutes: 11, agitation: '第 1 分钟连续，之后每 30s 摇 5s', stopBath: '停显 1 分钟', fixer: '定影 5 分钟', washMinutes: 12, pushPull: 'N', process: 'blackwhite', processMismatch: false, note: '齿孔边缘略高密度', schemaRev: 3 },
  { id: 5, filmId: 5, developerId: 1, dilution: '1:1', tempC: 24, devMinutes: 6.5, agitation: '每 30s 摇 5s', stopBath: '停显 1 分钟', fixer: '定影 5 分钟', washMinutes: 10, pushPull: '-1', process: 'blackwhite', processMismatch: false, note: '大画幅按页片盘显', schemaRev: 3 },
  { id: 6, filmId: 1, developerId: 1, dilution: '1:1', tempC: 20, devMinutes: 12.5, agitation: '每 30s 摇 5s，后段减少', stopBath: '停显 1 分钟', fixer: '定影 5 分钟', washMinutes: 10, pushPull: '+2', process: 'blackwhite', processMismatch: false, note: '阴天场景可尝试', schemaRev: 3 },
  { id: 7, filmId: 2, developerId: 3, dilution: '1:3', tempC: 20, devMinutes: 13, agitation: '每 30s 摇 5s', stopBath: '停显 1 分钟', fixer: '定影 5 分钟', washMinutes: 12, pushPull: '+1', process: 'blackwhite', processMismatch: false, note: '颗粒明显，反差充足', schemaRev: 3 },
  // 老配方：Portra（彩色胶片）错挂到 D-76（黑白药），补工艺时标出、不允许再用于实冲
  { id: 8, filmId: 3, developerId: 1, dilution: '1:1', tempC: 20, devMinutes: 8, agitation: '每 30s 摇 5s', stopBath: '酸性停显 1 分钟', fixer: '快速定影 5 分钟', washMinutes: 10, pushPull: 'N', process: 'color', processMismatch: true, note: '老配方工艺对不上，已停用，勿再冲卷', schemaRev: 3 }
]

const runSeeds: DevRun[] = [
  { id: 1, batchNo: 'R-260918-01', recipeId: 1, actualTempC: 20.2, actualMinutes: 9.4, tankType: '双联罐', runDate: '2026-09-18', result: '密度均匀，中间调细腻', schemaRev: 3 },
  { id: 2, batchNo: 'R-260920-02', recipeId: 2, actualTempC: 20.5, actualMinutes: 7.2, tankType: '双联罐', runDate: '2026-09-20', result: '暗部略薄，高光可控', schemaRev: 3 },
  { id: 3, batchNo: 'R-260921-03', recipeId: 3, actualTempC: 38.1, actualMinutes: 3.25, tankType: '深罐', runDate: '2026-09-21', result: '肤色自然，灰雾轻微', schemaRev: 3 },
  { id: 4, batchNo: 'R-260922-04', recipeId: 4, actualTempC: 19.8, actualMinutes: 11.2, tankType: '双联罐', runDate: '2026-09-22', result: '反差合适，边缘密度偏高', schemaRev: 3 },
  { id: 5, batchNo: 'R-260923-05', recipeId: 5, actualTempC: 24.2, actualMinutes: 6.4, tankType: '深罐', runDate: '2026-09-23', result: '高光保留，暗部通透', schemaRev: 3 },
  { id: 6, batchNo: 'R-260924-06', recipeId: 6, actualTempC: 19.5, actualMinutes: 13.2, tankType: '双联罐', runDate: '2026-09-24', result: '反差稍强，颗粒可接受', schemaRev: 3 },
  { id: 7, batchNo: 'R-260925-07', recipeId: 7, actualTempC: 20.1, actualMinutes: 12.8, tankType: '双联罐', runDate: '2026-09-25', result: '阴影细节不足，建议延长 0.5 分钟', schemaRev: 3 }
]

const v1Stores = {
  films: '++id, model, format, expireDate, rollsLeft',
  developers: '++id, category, state, mixedAt',
  recipes: '++id, filmId, developerId, dilution, pushPull, tempC',
  runs: '++id, recipeId, runDate, tankType'
}

export class FilmDevDatabase extends Dexie {
  films!: Table<FilmStock, number>
  developers!: Table<Developer, number>
  recipes!: Table<DevRecipe, number>
  runs!: Table<DevRun, number>

  constructor() {
    super('gbfilmdev-db')
    this.version(1).stores(v1Stores)
    this.version(2).stores(v1Stores).upgrade(async (transaction) => {
      await transaction.table('films').toCollection().modify((film: FilmStock) => {
        film.schemaRev = 2
      })
      await transaction.table('developers').toCollection().modify((developer: Developer) => {
        developer.schemaRev = 2
      })
      await transaction.table('recipes').toCollection().modify((recipe: DevRecipe) => {
        recipe.schemaRev = 2
      })
      await transaction.table('runs').toCollection().modify((run: DevRun) => {
        run.schemaRev = 2
      })
    })
    // v3：按胶片工艺管住配方——给胶片/药水/老配方回填工艺，
    // 胶片与药水工艺对不上的老配方打 processMismatch 标记，实冲页不再可选。
    this.version(3).stores(v1Stores).upgrade(async (transaction) => {
      const filmTable = transaction.table<FilmStock, number>('films')
      const developerTable = transaction.table<Developer, number>('developers')
      const recipeTable = transaction.table<DevRecipe, number>('recipes')
      const runTable = transaction.table<DevRun, number>('runs')

      const allFilms: FilmStock[] = await transaction.table('films').toArray()
      const allDevelopers: Developer[] = await transaction.table('developers').toArray()
      const filmById = new Map<number, FilmStock>(allFilms.map((film) => [film.id as number, film]))
      const developerById = new Map<number, Developer>(allDevelopers.map((developer) => [developer.id as number, developer]))

      await filmTable.toCollection().modify((film: FilmStock) => {
        film.process = filmStockProcess(film)
        film.schemaRev = CURRENT_SCHEMA_REV
      })
      await developerTable.toCollection().modify((developer: Developer) => {
        developer.process = developerKindProcess(developer)
        developer.schemaRev = CURRENT_SCHEMA_REV
      })
      await recipeTable.toCollection().modify((recipe: DevRecipe) => {
        const film = filmById.get(recipe.filmId)
        const developer = developerById.get(recipe.developerId)
        recipe.process = resolveRecipeProcess(recipe, film) ?? undefined
        recipe.processMismatch = !checkRecipeProcess(film, developer).matched
        recipe.schemaRev = CURRENT_SCHEMA_REV
      })
      await runTable.toCollection().modify((run: DevRun) => {
        run.schemaRev = CURRENT_SCHEMA_REV
      })
    })
  }
}

export const db = new FilmDevDatabase()

db.on('populate', () => Promise.all([
  db.films.bulkAdd(plain(filmSeeds)),
  db.developers.bulkAdd(plain(developerSeeds)),
  db.recipes.bulkAdd(plain(recipeSeeds)),
  db.runs.bulkAdd(plain(runSeeds))
]))
