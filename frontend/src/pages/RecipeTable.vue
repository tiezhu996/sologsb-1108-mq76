<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DilutionInput from '../components/common/DilutionInput.vue'
import PushPullTag from '../components/common/PushPullTag.vue'
import TimeTempCurve from '../components/common/TimeTempCurve.vue'
import { calculateCompensatedMinutes, useTempCompensate } from '../hooks/useTempCompensate'
import { useRecipeFilter } from '../hooks/useRecipeFilter'
import { useRecipeProcess, type RecipeProcessInfo } from '../hooks/useRecipeProcess'
import { baselineTempOf, ProcessMismatchError } from '../utils/process'
import { useDeveloperStore } from '../stores/developerStore'
import { useFilmStore } from '../stores/filmStore'
import { useRecipeStore } from '../stores/recipeStore'
import type { Dilution } from '../types/developer'
import type { DevRecipe, PushPull } from '../types/dev-recipe'
import type { FilmProcess } from '../types/film-stock'

interface RecipeForm {
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
  note: string
}

const filmStore = useFilmStore()
const developerStore = useDeveloperStore()
const recipeStore = useRecipeStore()
const { filmId, dilution, pushPull, filteredRecipes, resetFilters } = useRecipeFilter()
const { findFilm, findDeveloper, resolve } = useRecipeProcess()
const showForm = ref(false)
const saving = ref(false)
const sampleWorkingVolume = ref(300)

const form = reactive<RecipeForm>({
  filmId: 1,
  developerId: 1,
  dilution: '1:1',
  tempC: 20,
  devMinutes: 8,
  agitation: '每 30s 摇 5s',
  stopBath: '酸性停显 1 分钟',
  fixer: '快速定影 5 分钟',
  washMinutes: 10,
  pushPull: 'N',
  note: ''
})

// 表单里胶片与药水的工艺核对：选串了当场挡下
const formProcess = computed(() => {
  const film = findFilm(form.filmId)
  const developer = findDeveloper(form.developerId)
  if (!film || !developer) return null
  return {
    filmProcess: film.process ?? null,
    developerProcess: developer.process ?? null,
    matched: film.process === developer.process,
    baselineTempC: baselineTempOf(film.process ?? 'blackwhite')
  }
})

// 黑白 20°C、彩色 38°C：选好胶片后把工艺基准温度带进表单（仍可手改记录值）
watch(
  () => [form.filmId, form.developerId] as const,
  () => {
    const kind: FilmProcess | undefined = findFilm(form.filmId)?.process
    if (kind && formProcess.value?.matched) {
      form.tempC = baselineTempOf(kind)
    }
  }
)

// 查看温度：跨黑白/彩色清单时，用当前筛选第一条配方的工艺基准做起点
const firstProcess = computed<FilmProcess>(() => filteredRecipes.value[0]?.process ?? 'blackwhite')
const referenceTemp = computed(() => baselineTempOf(firstProcess.value))
const { actualTempC, suggest } = useTempCompensate(referenceTemp)

watch(referenceTemp, (value) => {
  actualTempC.value = value
}, { immediate: true })

const curvePoints = computed(() => {
  const recipe = filteredRecipes.value[0]
  if (!recipe) return []
  // 曲线以该配方的工艺基准温度为锚点
  const base = baselineTempOf(recipe.process ?? 'blackwhite')
  return Array.from({ length: 13 }, (_, index) => {
    const temp = Math.round((base - 3 + index * 0.5) * 10) / 10
    return {
      tempC: temp,
      minutes: calculateCompensatedMinutes(recipe.devMinutes, temp, base)
    }
  })
})

function filmLabel(id: number): string {
  const film = findFilm(id)
  return film ? `${film.model} · ${film.format} · ${film.emulsionNo}` : '未知胶片'
}

function developerLabel(id: number): string {
  const developer = findDeveloper(id)
  return developer ? `${developer.name} · ${developer.category}` : '未知显影液'
}

function infoFor(recipe: DevRecipe): RecipeProcessInfo {
  return resolve(recipe)
}

// 同一条配方在配方表的折算：以工艺基准温度（黑白 20 / 彩色 38）为基准
function suggestedFor(recipe: DevRecipe): number {
  const base = baselineTempOf(recipe.process ?? 'blackwhite')
  return suggest(recipe.devMinutes, actualTempC.value, base).minutes
}

function pickCurveTemp(temp: number): void {
  actualTempC.value = temp
}

function deriveRecipe(recipe: DevRecipe): void {
  form.filmId = recipe.filmId
  form.developerId = recipe.developerId
  form.dilution = recipe.dilution
  form.tempC = recipe.tempC
  form.devMinutes = recipe.devMinutes
  form.agitation = recipe.agitation
  form.stopBath = recipe.stopBath
  form.fixer = recipe.fixer
  form.washMinutes = recipe.washMinutes
  form.pushPull = recipe.pushPull
  form.note = `派生自配方 #${recipe.id ?? '原记录'}${recipe.note ? `：${recipe.note}` : ''}`
  showForm.value = true
}

async function submitRecipe(): Promise<void> {
  if (!form.filmId || !form.developerId || !form.devMinutes) {
    ElMessage.warning('请选择胶片、显影液并填写显影时间')
    return
  }
  if (formProcess.value && !formProcess.value.matched) {
    ElMessage.error(formProcess.value ? filmProcessMismatchReason() : '胶片与显影液工艺对不上')
    return
  }
  saving.value = true
  try {
    await recipeStore.addRecipe({
      filmId: Number(form.filmId),
      developerId: Number(form.developerId),
      dilution: form.dilution,
      tempC: Number(form.tempC),
      devMinutes: Number(form.devMinutes),
      agitation: form.agitation.trim() || '每 30s 摇 5s',
      stopBath: form.stopBath.trim() || '酸性停显 1 分钟',
      fixer: form.fixer.trim() || '快速定影 5 分钟',
      washMinutes: Number(form.washMinutes),
      pushPull: form.pushPull,
      note: form.note.trim()
    })
    ElMessage.success('冲洗配方已保存')
    form.note = ''
    showForm.value = false
  } catch (error) {
    if (error instanceof ProcessMismatchError) {
      ElMessage.error(error.message)
    } else {
      throw error
    }
  } finally {
    saving.value = false
  }
}

function filmProcessMismatchReason(): string {
  const film = findFilm(form.filmId)
  const developer = findDeveloper(form.developerId)
  if (!film || !developer) return '胶片或显影液在台账中找不到，无法核对工艺'
  return film.process === 'color'
    ? `胶片这头是彩色胶片（${film.model}），药水那头却是黑白药（${developer.category}），请改用 C-41 彩色套药`
    : `药水那头是彩色套药（${developer.category}），胶片这头却是黑白胶片（${film.model}），请改用黑白显影液`
}

onMounted(async () => {
  await Promise.all([filmStore.load(), developerStore.load(), recipeStore.load()])
  if (filmStore.films[0]?.id !== undefined) form.filmId = filmStore.films[0].id
  const usableDeveloper = developerStore.developers.find((item) => item.state !== '报废')
  if (usableDeveloper?.id !== undefined) form.developerId = usableDeveloper.id
})
</script>

<template>
  <section class="page-shell">
    <header class="page-hero page-hero--compact">
      <div>
        <span class="eyebrow">PROCESS RECIPES</span>
        <h1>配方表</h1>
        <p>按胶片工艺管住配方：黑白胶片配黑白药（基准 20°C），彩色胶片配彩色套药（基准 38°C），调温度即时折算。</p>
      </div>
      <button type="button" class="primary-button" data-testid="new-recipe" @click="showForm = !showForm">
        {{ showForm ? '收起表单' : '新建配方' }}
      </button>
    </header>

    <form v-if="showForm" class="inline-form" data-testid="form-recipe" @submit.prevent="submitRecipe">
      <div class="inline-form__head">
        <div>
          <h2>编排冲洗配方</h2>
          <p>彩色胶片只能配 C-41 彩色套药，黑白胶片只能配黑白药；选串了当场挡下。</p>
        </div>
      </div>
      <div class="form-grid form-grid--four">
        <label class="span-2">
          <span>胶片</span>
          <select v-model.number="form.filmId" data-testid="field-filmId">
            <option v-for="film in filmStore.films" :key="film.id" :value="film.id">
              {{ filmLabel(film.id ?? 0) }}
            </option>
          </select>
          <small class="field-hint">
            {{ findFilm(form.filmId)?.process === 'color' ? '彩色胶片 · 彩色工艺' : '黑白胶片 · 黑白工艺' }}
          </small>
        </label>
        <label class="span-2">
          <span>显影液</span>
          <select v-model.number="form.developerId" data-testid="field-developerId">
            <option v-for="developer in developerStore.developers" :key="developer.id" :value="developer.id">
              {{ developerLabel(developer.id ?? 0) }}
            </option>
          </select>
          <small class="field-hint">
            {{ findDeveloper(form.developerId)?.process === 'color' ? '彩色套药 · 彩色工艺' : '黑白药 · 黑白工艺' }}
          </small>
        </label>
        <div v-if="formProcess && !formProcess.matched" class="span-4 process-alert" data-testid="process-alert">
          <strong>工艺对不上，已挡下：</strong>{{ filmProcessMismatchReason() }}
        </div>
        <div v-else-if="formProcess" class="span-4 process-ok" data-testid="process-ok">
          工艺一致：{{ formProcess.filmProcess === 'color' ? '彩色工艺' : '黑白工艺' }}，工艺基准温度 {{ formProcess.baselineTempC }}°C
        </div>
        <div class="span-2">
          <DilutionInput
            v-model:ratio="form.dilution"
            v-model:working-volume-ml="sampleWorkingVolume"
            ratio-test-id="field-dilution"
            volume-test-id="field-workingVolumeMl"
          />
        </div>
        <label>
          <span>显影温度</span>
          <input v-model.number="form.tempC" data-testid="field-tempC" type="number" min="15" max="45" step="0.5" />
          <small class="field-hint">
            工艺基准 {{ formProcess?.baselineTempC ?? 20 }}°C
            <template v-if="formProcess && form.tempC !== formProcess.baselineTempC">· 当前偏离基准，仅作记录值</template>
          </small>
        </label>
        <label>
          <span>显影时间</span>
          <input v-model.number="form.devMinutes" data-testid="field-devMinutes" type="number" min="0.5" max="60" step="0.25" />
        </label>
        <label>
          <span>摇罐方式</span>
          <input v-model="form.agitation" data-testid="field-agitation" type="text" />
        </label>
        <label>
          <span>停显</span>
          <input v-model="form.stopBath" data-testid="field-stopBath" type="text" />
        </label>
        <label class="span-2">
          <span>定影</span>
          <input v-model="form.fixer" data-testid="field-fixer" type="text" />
        </label>
        <label>
          <span>水洗分钟</span>
          <input v-model.number="form.washMinutes" data-testid="field-washMinutes" type="number" min="1" max="60" />
        </label>
        <label>
          <span>推拉档</span>
          <select v-model="form.pushPull" data-testid="field-pushPull">
            <option value="-1">拉档 -1</option>
            <option value="N">标准 N</option>
            <option value="+1">推档 +1</option>
            <option value="+2">推档 +2</option>
          </select>
        </label>
        <label class="span-4">
          <span>经验注释</span>
          <input v-model="form.note" data-testid="field-note" type="text" placeholder="记录新批次需要留意的曝光或密度特点" />
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="ghost-button" @click="showForm = false">取消</button>
        <button
          type="submit"
          class="primary-button"
          data-testid="submit-recipe"
          :disabled="saving || (formProcess !== null && !formProcess.matched)"
        >
          {{ saving ? '保存中…' : '保存配方' }}
        </button>
      </div>
    </form>

    <div class="panel recipe-toolbar">
      <div class="quick-filters">
        <label>
          <span>胶片</span>
          <select v-model="filmId">
            <option value="all">全部胶片</option>
            <option v-for="film in filmStore.films" :key="film.id" :value="film.id">{{ film.model }} · {{ film.emulsionNo }}</option>
          </select>
        </label>
        <label>
          <span>稀释比</span>
          <select v-model="dilution">
            <option value="all">全部稀释比</option>
            <option value="1:1">1:1</option>
            <option value="1:3">1:3</option>
          </select>
        </label>
        <label>
          <span>推拉档</span>
          <select v-model="pushPull">
            <option value="all">全部档位</option>
            <option value="-1">拉档 -1</option>
            <option value="N">标准 N</option>
            <option value="+1">推档 +1</option>
            <option value="+2">推档 +2</option>
          </select>
        </label>
        <label>
          <span>查看温度</span>
          <input v-model.number="actualTempC" type="number" min="15" max="45" step="0.5" />
        </label>
      </div>
      <button type="button" class="ghost-button" @click="resetFilters">重置筛选</button>
    </div>

    <div class="recipe-layout">
      <div class="panel">
        <div class="panel__head">
          <div>
            <h2>配方清单</h2>
            <p>
              当前筛选显示 {{ filteredRecipes.length }} 条，共 {{ recipeStore.recipes.length }} 条。
              <span v-if="recipeStore.mismatchCount" class="mismatch-inline" data-testid="mismatch-summary">
                {{ recipeStore.mismatchCount }} 条老配方工艺对不上，已标出且不能用于实冲。
              </span>
            </p>
          </div>
          <span class="count-pill">配方数 <strong data-testid="count-recipe">{{ recipeStore.recipes.length }}</strong></span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>胶片 / 显影液</th>
                <th>工艺基准</th>
                <th>查看温度折算</th>
                <th>推拉档</th>
                <th>后处理</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="recipe in filteredRecipes"
                :key="recipe.id"
                class="recipe-row"
                :class="{ 'recipe-row--mismatch': infoFor(recipe).mismatch }"
                data-testid="row-recipe"
              >
                <td>
                  <div class="recipe-cell__head">
                    <strong>{{ filmLabel(recipe.filmId) }}</strong>
                    <span
                      class="status-chip"
                      :class="infoFor(recipe).process === 'color' ? 'status--rose' : 'status--cyan'"
                      data-testid="process-tag"
                    >{{ infoFor(recipe).processLabel }}</span>
                    <span v-if="infoFor(recipe).mismatch" class="status-chip status--danger" data-testid="mismatch-tag">
                      工艺对不上 · 停用
                    </span>
                  </div>
                  <small>{{ developerLabel(recipe.developerId) }} · {{ recipe.dilution }}</small>
                  <small v-if="infoFor(recipe).mismatch" class="text-danger mismatch-reason">
                    {{ infoFor(recipe).check.reason }}
                  </small>
                  <em v-if="recipe.note">{{ recipe.note }}</em>
                </td>
                <td>
                  <strong>{{ infoFor(recipe).baselineTempC ?? recipe.tempC }}°C 基准</strong>
                  <small>{{ recipe.devMinutes.toFixed(2) }} 分钟</small>
                  <small v-if="recipe.tempC !== infoFor(recipe).baselineTempC">记录值 {{ recipe.tempC }}°C</small>
                </td>
                <td>
                  <template v-if="!infoFor(recipe).mismatch">
                    <strong class="accent-number">{{ suggestedFor(recipe).toFixed(2) }} 分钟</strong>
                    <small>{{ actualTempC }}°C 查看温度</small>
                  </template>
                  <small v-else class="text-danger">工艺对不上，不折算</small>
                </td>
                <td><PushPullTag :value="recipe.pushPull" show-hint /></td>
                <td>
                  <span>{{ recipe.agitation }}</span>
                  <small>{{ recipe.stopBath }} · {{ recipe.fixer }} · 水洗 {{ recipe.washMinutes }} 分钟</small>
                  <button type="button" class="text-button" @click="deriveRecipe(recipe)">复制派生</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="filteredRecipes.length === 0" class="inline-empty">没有匹配配方，重置筛选或新建一条。</div>
        </div>
      </div>

      <aside>
        <TimeTempCurve
          :points="curvePoints"
          :selected-temp="actualTempC"
          title="时间补偿曲线"
          @pick-temp="pickCurveTemp"
        />
        <div class="panel formula-note">
          <h2>补偿模型</h2>
          <p>
            统一按工艺基准温度折算：黑白 20°C、彩色 38°C。
            相对基准每升高 1°C 显影时间乘 0.9；每降低 1°C 乘 1.1。配方表与实冲页同一条配方得数一致。
          </p>
          <strong>
            {{ actualTempC }}°C · 建议
            {{ suggest(filteredRecipes[0]?.devMinutes ?? 0, actualTempC, referenceTemp).minutes.toFixed(2) }}
            分钟（基准 {{ referenceTemp }}°C）
          </strong>
        </div>
      </aside>
    </div>
  </section>
</template>
