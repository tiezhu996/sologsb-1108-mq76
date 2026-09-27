export type FilmProcess = '黑白' | '彩色'

/** 配方工艺：与胶片、显影液一致时为黑白/彩色，两头对不上时标记为冲突 */
export type RecipeProcess = FilmProcess | '冲突'
