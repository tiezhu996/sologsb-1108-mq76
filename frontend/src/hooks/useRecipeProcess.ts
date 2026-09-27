import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFilmStore } from '../stores/filmStore'
import { useDeveloperStore } from '../stores/developerStore'
import { useRecipeStore } from '../stores/recipeStore'
import {
  baselineTempOf,
  checkRecipeProcess,
  PROCESS_LABEL,
  type ProcessCheckResult
} from '../utils/process'
import type { DevRecipe } from '../types/dev-recipe'
import type { Developer } from '../types/developer'
import type { FilmProcess, FilmStock } from '../types/film-stock'

export interface RecipeProcessInfo {
  film: FilmStock | undefined
  developer: Developer | undefined
  process: FilmProcess | null
  /** 工艺基准温度：黑白 20°C，彩色 38°C */
  baselineTempC: number | null
  processLabel: string
  /** 当前台账实时核对结果（老配方同时保留登记时的 processMismatch 标记） */
  check: ProcessCheckResult
  /** 老配方补工艺时已标出对不上，或当前台账核对对不上 */
  mismatch: boolean
}

/**
 * 配方工艺解析：把配方折叠到当前胶片与药水台账上核对工艺。
 * 实冲页选配方时只能通过 runnableRecipes（processMismatch !== true）。
 */
export function useRecipeProcess(recipeRef?: Ref<DevRecipe | undefined>) {
  const filmStore = useFilmStore()
  const developerStore = useDeveloperStore()
  const recipeStore = useRecipeStore()
  const { films } = storeToRefs(filmStore)
  const { developers } = storeToRefs(developerStore)

  function findFilm(id: number): FilmStock | undefined {
    return films.value.find((item) => item.id === id)
  }

  function findDeveloper(id: number): Developer | undefined {
    return developers.value.find((item) => item.id === id)
  }

  function resolve(recipe: DevRecipe): RecipeProcessInfo {
    const film = findFilm(recipe.filmId)
    const developer = findDeveloper(recipe.developerId)
    const check = checkRecipeProcess(film, developer)
    const processKind = film ? check.filmProcess : recipe.process ?? null
    const mismatch = recipe.processMismatch === true || !check.matched
    return {
      film,
      developer,
      process: processKind,
      baselineTempC: processKind ? baselineTempOf(processKind) : null,
      processLabel: processKind ? PROCESS_LABEL[processKind] : '工艺未知',
      check,
      mismatch
    }
  }

  const info = computed<RecipeProcessInfo | null>(() => {
    const recipe = recipeRef?.value
    return recipe ? resolve(recipe) : null
  })

  return { films, developers, findFilm, findDeveloper, resolve, info }
}
