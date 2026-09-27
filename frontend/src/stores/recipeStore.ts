import { defineStore } from 'pinia'
import { db, plain, CURRENT_SCHEMA_REV } from '../utils/db'
import { calculateCompensatedMinutes } from '../hooks/useTempCompensate'
import {
  baselineTempOf,
  checkRecipeProcess,
  ProcessMismatchError
} from '../utils/process'
import type { DevRecipe } from '../types/dev-recipe'
import type { Dilution } from '../types/developer'
import type { PushPull } from '../types/dev-recipe'
import type { FilmProcess } from '../types/film-stock'

type NewRecipe = Omit<DevRecipe, 'id' | 'schemaRev' | 'process' | 'processMismatch'>

export const useRecipeStore = defineStore('recipe', {
  state: () => ({
    recipes: [] as DevRecipe[],
    loading: false,
    filterFilmId: 'all' as number | 'all',
    filterDilution: 'all' as Dilution | 'all',
    filterPushPull: 'all' as PushPull | 'all',
    targetTempC: 20
  }),
  getters: {
    filteredRecipes: (state) => state.recipes.filter((recipe) => {
      const matchesFilm = state.filterFilmId === 'all' || recipe.filmId === state.filterFilmId
      const matchesDilution = state.filterDilution === 'all' || recipe.dilution === state.filterDilution
      const matchesPushPull = state.filterPushPull === 'all' || recipe.pushPull === state.filterPushPull
      return matchesFilm && matchesDilution && matchesPushPull
    }),
    /** 工艺对得上、可以继续冲卷的配方（实冲页只能从这里挑） */
    runnableRecipes: (state) => state.recipes.filter((recipe) => !recipe.processMismatch),
    mismatchCount: (state) => state.recipes.filter((recipe) => recipe.processMismatch).length,
    compensatedRecipes(): Array<DevRecipe & { compensatedMinutes: number }> {
      return this.filteredRecipes.map((recipe) => {
        const processKind: FilmProcess = recipe.process ?? 'blackwhite'
        return {
          ...recipe,
          compensatedMinutes: calculateCompensatedMinutes(
            recipe.devMinutes,
            this.targetTempC,
            baselineTempOf(processKind)
          )
        }
      })
    }
  },
  actions: {
    async load(): Promise<void> {
      this.loading = true
      try {
        this.recipes = await db.recipes.orderBy('id').reverse().toArray()
      } finally {
        this.loading = false
      }
    },
    async addRecipe(payload: NewRecipe): Promise<number> {
      // 按胶片工艺管住配方：黑白胶片配黑白药，彩色胶片配彩色套药
      const [film, developer] = await Promise.all([
        db.films.get(payload.filmId),
        db.developers.get(payload.developerId)
      ])
      const check = checkRecipeProcess(film, developer)
      if (!check.matched || check.filmProcess === null) {
        throw new ProcessMismatchError(check.reason)
      }
      const next = {
        ...payload,
        process: check.filmProcess,
        processMismatch: false,
        schemaRev: CURRENT_SCHEMA_REV
      }
      const id = await db.recipes.add(plain(next))
      await this.load()
      return id
    },
    async updateNote(id: number, note: string): Promise<void> {
      await db.recipes.update(id, plain({ note }))
      await this.load()
    }
  }
})
