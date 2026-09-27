import { defineStore } from 'pinia'
import { db, plain, SCHEMA_REV } from '../utils/db'
import type { DevRun } from '../types/dev-run'

type NewRun = Omit<DevRun, 'id' | 'schemaRev'>

export const useRunStore = defineStore('run', {
  state: () => ({
    runs: [] as DevRun[],
    loading: false
  }),
  getters: {
    recentRuns: (state) => [...state.runs]
      .sort((a, b) => b.runDate.localeCompare(a.runDate))
      .slice(0, 6)
  },
  actions: {
    async load(): Promise<void> {
      this.loading = true
      try {
        this.runs = await db.runs.orderBy('id').reverse().toArray()
      } finally {
        this.loading = false
      }
    },
    async addRun(payload: NewRun): Promise<number> {
      const recipe = await db.recipes.get(payload.recipeId)
      if (!recipe) {
        throw new Error('选中的配方不存在，请刷新后重试')
      }
      if (recipe.process === '冲突') {
        throw new Error('该配方工艺冲突（胶片与显影液不属于同一工艺），不能用于冲洗记录，请先在配方表中处理')
      }
      const next = { ...payload, schemaRev: SCHEMA_REV }
      const id = await db.runs.add(plain(next))
      const developer = await db.developers.get(recipe.developerId)
      if (developer && developer.id !== undefined && developer.state !== '报废') {
        await db.developers.update(developer.id, plain({ usedRolls: developer.usedRolls + 1 }))
      }
      await this.load()
      return id
    },
    async writeBackNote(runId: number, recipeId: number): Promise<void> {
      const run = await db.runs.get(runId)
      if (!run) return
      const note = `${run.runDate} 实冲 ${run.actualTempC}°C / ${run.actualMinutes} 分钟：${run.result}`
      await db.recipes.update(recipeId, plain({ note }))
    }
  }
})
