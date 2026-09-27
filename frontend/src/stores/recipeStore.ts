import { defineStore } from 'pinia'
import { db, plain, SCHEMA_REV } from '../utils/db'
import {
  compensatedMinutesForRecipe,
  describeProcessMismatch,
  PROCESS_BASELINE_TEMP_C,
  resolveRecipeProcess
} from '../utils/process'
import type { DevRecipe } from '../types/dev-recipe'
import type { Dilution } from '../types/developer'
import type { PushPull } from '../types/dev-recipe'

type NewRecipe = Omit<DevRecipe, 'id' | 'schemaRev' | 'process'>

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
    /** 工艺明确的配方才能被冲洗记录选用；冲突配方只保留在配方表里待处理 */
    selectableRecipes: (state) => state.recipes.filter((recipe) => recipe.process !== '冲突'),
    conflictedRecipes: (state) => state.recipes.filter((recipe) => recipe.process === '冲突'),
    compensatedRecipes(): Array<DevRecipe & { compensatedMinutes: number }> {
      return this.filteredRecipes.map((recipe) => ({
        ...recipe,
        compensatedMinutes: compensatedMinutesForRecipe(recipe, this.targetTempC)
      }))
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
      const film = await db.films.get(payload.filmId)
      const developer = await db.developers.get(payload.developerId)
      if (!film || !developer) {
        throw new Error('选中的胶片或显影液不存在，请刷新后重试')
      }
      const { process, mismatch } = resolveRecipeProcess(film, developer)
      if (mismatch || process === '冲突') {
        throw new Error(describeProcessMismatch(film, developer))
      }
      // 工艺基准温度由工艺决定：黑白 20°C、彩色 38°C，不接受其他基准
      const tempC = PROCESS_BASELINE_TEMP_C[process]
      const next = { ...payload, tempC, process, schemaRev: SCHEMA_REV }
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
