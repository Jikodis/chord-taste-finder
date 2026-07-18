import { buildCatalog, type CatalogItem } from './catalog'

let cache: { list: CatalogItem[]; map: Map<string, CatalogItem> } | null = null

function ensure() {
  if (!cache) {
    const list = buildCatalog()
    cache = { list, map: new Map(list.map((i) => [i.id, i])) }
  }
  return cache
}

export function catalogList(): CatalogItem[] {
  return ensure().list
}

export function catalogItem(id: string): CatalogItem | undefined {
  return ensure().map.get(id)
}
