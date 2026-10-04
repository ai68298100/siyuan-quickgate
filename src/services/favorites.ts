/**
 * 收藏与最近使用（TODO L474 · R76 命令面板体验）——纯逻辑 + 持久化形状。
 * 载体：/storage/petal/siyuan-quickgate/favorites.json（快门自身存储，非桥载体）。
 * 纪律：键=(plugin, command)；favorites 上限 100（LRU 语义：最近加的在最前）；recent 上限 20（去重前移）。
 * 隐私：recent 只记 plugin/command/title 元数据（不记参数值/正文）；清除走 favorites.remove scope。
 */
export interface FavEntry {
    plugin: string;
    command: string;
    title: string;
    addedAt: string;
}

export interface RecentEntry {
    plugin: string;
    command: string;
    title: string;
    at: string;
}

export interface FavoritesStore {
    schemaVersion: 1;
    favorites: FavEntry[];
    recent: RecentEntry[];
}

export const FAVORITES_CAP = 100;
export const RECENT_CAP = 20;

export function emptyFavorites(): FavoritesStore {
    return { schemaVersion: 1, favorites: [], recent: [] };
}

/** fail-open：坏形状 → 空库（收藏丢失可重加，不阻断命令通道） */
export function normalizeFavorites(raw: unknown): FavoritesStore {
    if (!raw || typeof raw !== "object") return emptyFavorites();
    const obj = raw as Record<string, unknown>;
    if (obj.schemaVersion !== 1) return emptyFavorites();
    const out = emptyFavorites();
    const favs = Array.isArray(obj.favorites) ? obj.favorites : [];
    for (const e of favs) {
        const o = e as Record<string, unknown>;
        if (typeof o.plugin === "string" && typeof o.command === "string") {
            out.favorites.push({ plugin: o.plugin, command: o.command, title: typeof o.title === "string" ? o.title : o.command, addedAt: typeof o.addedAt === "string" ? o.addedAt : "" });
        }
    }
    const recents = Array.isArray(obj.recent) ? obj.recent : [];
    for (const e of recents) {
        const o = e as Record<string, unknown>;
        if (typeof o.plugin === "string" && typeof o.command === "string") {
            out.recent.push({ plugin: o.plugin, command: o.command, title: typeof o.title === "string" ? o.title : o.command, at: typeof o.at === "string" ? o.at : "" });
        }
    }
    out.favorites = out.favorites.slice(0, FAVORITES_CAP);
    out.recent = out.recent.slice(0, RECENT_CAP);
    return out;
}

/** 加收藏：已存在则前移并刷新 title/addedAt；返回是否发生变更 */
export function upsertFavorite(store: FavoritesStore, entry: FavEntry, now = new Date().toISOString()): boolean {
    store.favorites = store.favorites.filter((f) => !(f.plugin === entry.plugin && f.command === entry.command));
    store.favorites.unshift({ ...entry, addedAt: now });
    store.favorites = store.favorites.slice(0, FAVORITES_CAP);
    return true;
}

/** scope：favorite（默认）| recent | both——recent 支持隐私清除 */
export function removeEntry(store: FavoritesStore, plugin: string, command: string, scope: "favorite" | "recent" | "both" = "favorite"): number {
    let removed = 0;
    if (scope === "favorite" || scope === "both") {
        const before = store.favorites.length;
        store.favorites = store.favorites.filter((f) => !(f.plugin === plugin && f.command === command));
        removed += before - store.favorites.length;
    }
    if (scope === "recent" || scope === "both") {
        const before = store.recent.length;
        store.recent = store.recent.filter((r) => !(r.plugin === plugin && r.command === command));
        removed += before - store.recent.length;
    }
    return removed;
}

/** 记最近使用：同键前移（去重），cap 截尾 */
export function pushRecent(store: FavoritesStore, entry: { plugin: string; command: string; title: string }, now = new Date().toISOString()): void {
    store.recent = store.recent.filter((r) => !(r.plugin === entry.plugin && r.command === entry.command));
    store.recent.unshift({ ...entry, at: now });
    store.recent = store.recent.slice(0, RECENT_CAP);
}
