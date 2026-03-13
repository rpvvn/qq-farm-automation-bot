const process = require('node:process');
/**
 * 运行时存储 - 自动化开关、种子偏好、账号管理
 */

const fs = require('node:fs');
const path = require('node:path');
const { getDataFile, ensureDataDir } = require('../config/runtime-paths');
const { readTextFile, readJsonFile, writeJsonFileAtomic } = require('../services/json-db');

const STORE_FILE = getDataFile('store.json');
const ACCOUNTS_FILE = getDataFile('accounts.json');
const KNOWN_FRIEND_GIDS_DIR = getDataFile('known_friend_gids');

function ensureKnownFriendGidsDir() {
    if (!fs.existsSync(KNOWN_FRIEND_GIDS_DIR)) {
        fs.mkdirSync(KNOWN_FRIEND_GIDS_DIR, { recursive: true });
    }
    return KNOWN_FRIEND_GIDS_DIR;
}

function getKnownFriendGidsCacheFile(accountId) {
    const safeId = String(accountId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(ensureKnownFriendGidsDir(), `${safeId}.json`);
}

function readKnownFriendGidsCache(accountId) {
    try {
        const file = getKnownFriendGidsCacheFile(accountId);
        if (fs.existsSync(file)) {
            const data = readJsonFile(file);
            if (data && Array.isArray(data.gids)) {
                return data.gids;
            }
        }
    } catch (e) {
        // 忽略读取错误
    }
    return null;
}

function writeKnownFriendGidsCache(accountId, gids) {
    try {
        const file = getKnownFriendGidsCacheFile(accountId);
        writeJsonFileAtomic(file, {
            gids: gids || [],
            updatedAt: Date.now(),
        });
    } catch (e) {
        // 忽略写入错误
    }
}
const ALLOWED_PLANTING_STRATEGIES = ['preferred', 'level', 'max_exp', 'max_fert_exp', 'max_profit', 'max_fert_profit', 'bag_priority'];
const ALLOWED_BAG_SEED_FALLBACK_STRATEGIES = ALLOWED_PLANTING_STRATEGIES.filter(s => s !== 'bag_priority');
const PUSHOO_CHANNELS = new Set([
    'webhook', 'qmsg', 'serverchan', 'pushplus', 'pushplushxtrip',
    'dingtalk', 'wecom', 'bark', 'gocqhttp', 'onebot', 'atri',
    'pushdeer', 'igot', 'telegram', 'feishu', 'ifttt', 'wecombot',
    'discord', 'wxpusher',
]);

const DEFAULT_FERTILIZER_LAND_TYPES = ['gold', 'black', 'red', 'normal'];
const FERTILIZER_LAND_TYPE_SET = new Set(DEFAULT_FERTILIZER_LAND_TYPES);
const INTERVAL_MAX_SEC = 86400;
const DEFAULT_KNOWN_FRIEND_GID_SYNC_COOLDOWN_SEC = 300;

function normalizeKnownFriendGids(input, fallback = []) {
    const source = Array.isArray(input) ? input : fallback;
    const normalized = [];
    for (const item of source) {
        const value = Number.parseInt(item, 10);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (normalized.includes(value)) continue;
        normalized.push(value);
    }
    return normalized;
}

function normalizeKnownFriendGidSyncCooldownSec(input, fallback = DEFAULT_KNOWN_FRIEND_GID_SYNC_COOLDOWN_SEC) {
    const value = Number.parseInt(input, 10);
    const base = Number.isFinite(value) ? value : fallback;
    return Math.max(30, Math.min(INTERVAL_MAX_SEC, base));
}

function normalizeBagSeedPriority(input) {
    if (!Array.isArray(input)) return [];
    const normalized = [];
    for (const item of input) {
        const value = Number.parseInt(item, 10);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (normalized.includes(value)) continue;
        normalized.push(value);
    }
    return normalized;
}

function normalizeBagSeedFallbackStrategy(input, fallback = 'level') {
    const strategy = String(input || '').trim();
    if (ALLOWED_BAG_SEED_FALLBACK_STRATEGIES.includes(strategy)) return strategy;
    return fallback;
}

const DEFAULT_OFFLINE_REMINDER = {
    channel: 'webhook',
    reloginUrlMode: 'none',
    endpoint: '',
    token: '',
    title: '账号下线提醒',
    msg: '账号下线',
    offlineDeleteSec: 0,
};
// ============ 全局配置 ============
const DEFAULT_ACCOUNT_CONFIG = {
    automation: {
        farm: true,
        farm_push: true,   // 收到 LandsNotify 推送时是否立即触发巡田
        land_upgrade: false, // 是否自动升级土地
        friend: true,       // 好友互动总开关
        friend_help_exp_limit: true, // 帮忙经验达上限后自动停止帮忙
        friend_steal: true, // 偷菜
        friend_help: true,  // 帮忙
        friend_bad: false,  // 捣乱(放虫草)
        task: true,
        // 以下功能默认启用，不再提供开关
        // email: true,
        // free_gifts: true,
        // share_reward: true,
        // vip_gift: true,
        // month_card: true,
        // open_server_gift: true,
        fertilizer_gift: false,
        fertilizer_buy: false,
        sell: false,
        fertilizer: 'smart',
        fertilizer_multi_season: true,
        fertilizer_land_types: [...DEFAULT_FERTILIZER_LAND_TYPES],
        fertilizer_smart_seconds: 300,
        skip_own_weed_bug: true,  // 不除自己草虫
    },
    plantingStrategy: 'max_exp',
    preferredSeedId: 0,
    intervals: {
        farm: 2,
        farmMin: 5,
        farmMax: 10,
        // 好友巡查：帮助和偷菜各自独立的间隔
        helpMin: 10,
        helpMax: 15,
        stealMin: 10,
        stealMax: 15,
    },
    friendQuietHours: {
        enabled: false,
        start: '23:00',
        end: '07:00',
    },
    knownFriendGids: [],
    knownFriendGidSyncCooldownSec: DEFAULT_KNOWN_FRIEND_GID_SYNC_COOLDOWN_SEC,
    friendBlacklist: [],
    // 蔬菜黑名单（偷菜时不偷的作物 seedId 列表）
    plantBlacklist: [
        20002,
        20003,
        20059,
        20065,
        20064,
        20060,
        20061,
    ],
    // 好友作物成熟后延迟多少秒再偷取（0=不延迟）
    stealDelaySeconds: 1,
    // 自己农田种植时是否随机地块顺序
    plantOrderRandom: true,
    // 自己农田种植时每块地间隔秒数（0=使用默认50ms）
    plantDelaySeconds: 2,
    // 化肥购买类型：organic（有机）或 normal（无机）
    fertilizerBuyType: 'normal',
    // 化肥购买数量（0=不限制，购买到点券不足为止）
    fertilizerBuyCount: 10,
    // 背包种子优先顺序（seedId 数组）
    bagSeedPriority: [],
    // 背包种子用完后的回退策略
    bagSeedFallbackStrategy: 'level',
    // 账号级别的下线提醒配置（null 表示使用上级配置）
    offlineReminder: null,
};
const ALLOWED_AUTOMATION_KEYS = new Set(Object.keys(DEFAULT_ACCOUNT_CONFIG.automation));

let accountFallbackConfig = {
    ...DEFAULT_ACCOUNT_CONFIG,
    // automation: { ...DEFAULT_ACCOUNT_CONFIG.automation },
    automation: { ...DEFAULT_ACCOUNT_CONFIG.automation, fertilizer_land_types: [...DEFAULT_FERTILIZER_LAND_TYPES] },
    intervals: { ...DEFAULT_ACCOUNT_CONFIG.intervals },
    friendQuietHours: { ...DEFAULT_ACCOUNT_CONFIG.friendQuietHours },
    knownFriendGids: [],
    knownFriendGidSyncCooldownSec: DEFAULT_KNOWN_FRIEND_GID_SYNC_COOLDOWN_SEC,
};

const globalConfig = {
    accountConfigs: {},
    defaultAccountConfig: cloneAccountConfig(DEFAULT_ACCOUNT_CONFIG),
    ui: {
        theme: 'light',
    },
    offlineReminder: { ...DEFAULT_OFFLINE_REMINDER },
    // 用户隔离的下线提醒配置: { [username]: config }
    userOfflineReminders: {},
    adminPasswordHash: '',
    // 公告配置
    announcement: {
        content: '',
        showOnce: true,
        updatedAt: 0,
    },
    // 用户已读公告记录: { [username]: updatedAt }
    announcementReadRecords: {},
    // 运行连接配置
    connectionConfig: null,
};

function normalizeOfflineReminder(input) {
    const src = (input && typeof input === 'object') ? input : {};
    let offlineDeleteSec = Number.parseInt(src.offlineDeleteSec, 10);
    if (!Number.isFinite(offlineDeleteSec) || offlineDeleteSec < 0) {
        offlineDeleteSec = DEFAULT_OFFLINE_REMINDER.offlineDeleteSec;
    }
    const rawChannel = (src.channel !== undefined && src.channel !== null)
        ? String(src.channel).trim().toLowerCase()
        : '';
    const endpoint = (src.endpoint !== undefined && src.endpoint !== null)
        ? String(src.endpoint).trim()
        : DEFAULT_OFFLINE_REMINDER.endpoint;
    const migratedChannel = rawChannel
        || (PUSHOO_CHANNELS.has(String(endpoint || '').trim().toLowerCase())
            ? String(endpoint || '').trim().toLowerCase()
            : DEFAULT_OFFLINE_REMINDER.channel);
    const channel = PUSHOO_CHANNELS.has(migratedChannel)
        ? migratedChannel
        : DEFAULT_OFFLINE_REMINDER.channel;
    const rawReloginUrlMode = (src.reloginUrlMode !== undefined && src.reloginUrlMode !== null)
        ? String(src.reloginUrlMode).trim().toLowerCase()
        : DEFAULT_OFFLINE_REMINDER.reloginUrlMode;
    const reloginUrlMode = new Set(['none', 'qq_link', 'qr_link']).has(rawReloginUrlMode)
        ? rawReloginUrlMode
        : DEFAULT_OFFLINE_REMINDER.reloginUrlMode;
    const token = (src.token !== undefined && src.token !== null)
        ? String(src.token).trim()
        : DEFAULT_OFFLINE_REMINDER.token;
    const title = (src.title !== undefined && src.title !== null)
        ? String(src.title).trim()
        : DEFAULT_OFFLINE_REMINDER.title;
    const msg = (src.msg !== undefined && src.msg !== null)
        ? String(src.msg).trim()
        : DEFAULT_OFFLINE_REMINDER.msg;
    return {
        channel,
        reloginUrlMode,
        endpoint,
        token,
        title,
        msg,
        offlineDeleteSec,
    };
}
function normalizeFertilizerLandTypes(input, fallback = DEFAULT_FERTILIZER_LAND_TYPES) {
    const source = Array.isArray(input) ? input : fallback;
    const normalized = [];
    for (const item of source) {
        const value = String(item || '').trim().toLowerCase();
        if (!FERTILIZER_LAND_TYPE_SET.has(value)) continue;
        if (normalized.includes(value)) continue;
        normalized.push(value);
    }
    return normalized;
}

function cloneAccountConfig(base = DEFAULT_ACCOUNT_CONFIG) {
    const srcAutomation = (base && base.automation && typeof base.automation === 'object')
        ? base.automation
        : {};
    const automation = { ...DEFAULT_ACCOUNT_CONFIG.automation };
    for (const key of Object.keys(automation)) {
        if (key === 'fertilizer_land_types') {
            automation[key] = normalizeFertilizerLandTypes(srcAutomation[key], DEFAULT_FERTILIZER_LAND_TYPES);
            continue;
        }
        if (srcAutomation[key] !== undefined) automation[key] = srcAutomation[key];
    }

    const rawBlacklist = Array.isArray(base.friendBlacklist) ? base.friendBlacklist : [];

    const knownFriendGids = normalizeKnownFriendGids(base.knownFriendGids);
    const knownFriendGidSyncCooldownSec = normalizeKnownFriendGidSyncCooldownSec(base.knownFriendGidSyncCooldownSec);

    // 蔬菜黑名单
    const rawPlantBlacklist = Array.isArray(base.plantBlacklist) ? base.plantBlacklist : [];

    // 化肥购买类型
    const allowedBuyTypes = ['organic', 'normal'];
    const fertilizerBuyType = allowedBuyTypes.includes(base.fertilizerBuyType)
        ? base.fertilizerBuyType
        : DEFAULT_ACCOUNT_CONFIG.fertilizerBuyType;

    return {
        ...base,
        automation,
        intervals: { ...(base.intervals || DEFAULT_ACCOUNT_CONFIG.intervals) },
        friendQuietHours: { ...(base.friendQuietHours || DEFAULT_ACCOUNT_CONFIG.friendQuietHours) },
        knownFriendGids,
        knownFriendGidSyncCooldownSec,
        friendBlacklist: rawBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0),
        plantingStrategy: ALLOWED_PLANTING_STRATEGIES.includes(String(base.plantingStrategy || ''))
            ? String(base.plantingStrategy)
            : DEFAULT_ACCOUNT_CONFIG.plantingStrategy,
        preferredSeedId: Math.max(0, Number.parseInt(base.preferredSeedId, 10) || 0),
        plantBlacklist: rawPlantBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0),
        stealDelaySeconds: Math.max(0, Math.min(300, Number(base.stealDelaySeconds) || 0)),
        plantOrderRandom: !!(base.plantOrderRandom),
        plantDelaySeconds: Math.max(0, Math.min(60, Number(base.plantDelaySeconds) || 0)),
        fertilizerBuyType,
        fertilizerBuyCount: Math.max(0, Math.min(10000, Number(base.fertilizerBuyCount) || 0)),
        bagSeedPriority: normalizeBagSeedPriority(base.bagSeedPriority),
        bagSeedFallbackStrategy: normalizeBagSeedFallbackStrategy(base.bagSeedFallbackStrategy),
        offlineReminder: base.offlineReminder ? normalizeOfflineReminder(base.offlineReminder) : null,
    };
}

function resolveAccountId(accountId) {
    const direct = (accountId !== undefined && accountId !== null) ? String(accountId).trim() : '';
    if (direct) return direct;
    const envId = String(process.env.FARM_ACCOUNT_ID || '').trim();
    return envId;
}

function normalizeAccountConfig(input, fallback = accountFallbackConfig) {
    const src = (input && typeof input === 'object') ? input : {};
    const cfg = cloneAccountConfig(fallback || DEFAULT_ACCOUNT_CONFIG);

    if (src.automation && typeof src.automation === 'object') {
        for (const [k, v] of Object.entries(src.automation)) {
            if (!ALLOWED_AUTOMATION_KEYS.has(k)) continue;
            if (k === 'fertilizer') {
                const allowed = ['both', 'normal', 'organic', 'smart', 'none'];
                cfg.automation[k] = allowed.includes(v) ? v : cfg.automation[k];
            } else if (k === 'fertilizer_land_types') {
                cfg.automation[k] = normalizeFertilizerLandTypes(v, cfg.automation[k]);
            } else if (k === 'fertilizer_smart_seconds') {
                cfg.automation[k] = Math.max(30, Math.min(3600, Number(v) || 300));
            } else {
                cfg.automation[k] = !!v;
            }
        }
    }

    if (src.plantingStrategy && ALLOWED_PLANTING_STRATEGIES.includes(src.plantingStrategy)) {
        cfg.plantingStrategy = src.plantingStrategy;
    }

    if (src.preferredSeedId !== undefined && src.preferredSeedId !== null) {
        cfg.preferredSeedId = Math.max(0, Number.parseInt(src.preferredSeedId, 10) || 0);
    }

    if (src.intervals && typeof src.intervals === 'object') {
        for (const [type, sec] of Object.entries(src.intervals)) {
            if (cfg.intervals[type] === undefined) continue;
            cfg.intervals[type] = Math.max(1, Number.parseInt(sec, 10) || cfg.intervals[type] || 1);
        }
        cfg.intervals = normalizeIntervals(cfg.intervals);
    } else {
        cfg.intervals = normalizeIntervals(cfg.intervals);
    }

    if (src.friendQuietHours && typeof src.friendQuietHours === 'object') {
        const old = cfg.friendQuietHours || {};
        cfg.friendQuietHours = {
            enabled: src.friendQuietHours.enabled !== undefined ? !!src.friendQuietHours.enabled : !!old.enabled,
            start: normalizeTimeString(src.friendQuietHours.start, old.start || '23:00'),
            end: normalizeTimeString(src.friendQuietHours.end, old.end || '07:00'),
        };
    }

    if (Array.isArray(src.friendBlacklist)) {
        cfg.friendBlacklist = src.friendBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0);
    }

    if (src.knownFriendGids !== undefined) {
        cfg.knownFriendGids = normalizeKnownFriendGids(src.knownFriendGids, cfg.knownFriendGids);
    }

    if (src.knownFriendGidSyncCooldownSec !== undefined) {
        cfg.knownFriendGidSyncCooldownSec = normalizeKnownFriendGidSyncCooldownSec(
            src.knownFriendGidSyncCooldownSec,
            cfg.knownFriendGidSyncCooldownSec,
        );
    }

    // 蔬菜黑名单
    if (Array.isArray(src.plantBlacklist)) {
        cfg.plantBlacklist = src.plantBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0);
    }

    // 偷取延迟
    if (src.stealDelaySeconds !== undefined && src.stealDelaySeconds !== null) {
        cfg.stealDelaySeconds = Math.max(0, Math.min(300, Number.parseInt(src.stealDelaySeconds, 10) || 0));
    }

    // 种植顺序随机
    if (src.plantOrderRandom !== undefined && src.plantOrderRandom !== null) {
        cfg.plantOrderRandom = !!src.plantOrderRandom;
    }

    // 种植延迟
    if (src.plantDelaySeconds !== undefined && src.plantDelaySeconds !== null) {
        cfg.plantDelaySeconds = Math.max(0, Math.min(60, Number(src.plantDelaySeconds) || 0));
    }

    // 化肥购买类型
    if (src.fertilizerBuyType !== undefined && src.fertilizerBuyType !== null) {
        const allowedTypes = ['organic', 'normal'];
        cfg.fertilizerBuyType = allowedTypes.includes(src.fertilizerBuyType) ? src.fertilizerBuyType : 'organic';
    }

    // 化肥购买数量
    if (src.fertilizerBuyCount !== undefined && src.fertilizerBuyCount !== null) {
        cfg.fertilizerBuyCount = Math.max(0, Math.min(10000, Number(src.fertilizerBuyCount) || 0));
    }

    // 背包种子优先顺序
    if (src.bagSeedPriority !== undefined && src.bagSeedPriority !== null) {
        cfg.bagSeedPriority = normalizeBagSeedPriority(src.bagSeedPriority);
    }

    // 背包种子回退策略
    if (src.bagSeedFallbackStrategy !== undefined && src.bagSeedFallbackStrategy !== null) {
        cfg.bagSeedFallbackStrategy = normalizeBagSeedFallbackStrategy(src.bagSeedFallbackStrategy);
    }

    // 账号级别的下线提醒配置
    if (src.offlineReminder !== undefined) {
        if (src.offlineReminder === null) {
            cfg.offlineReminder = null;
        } else {
            cfg.offlineReminder = normalizeOfflineReminder(src.offlineReminder);
        }
    }

    return cfg;
}

function getAccountConfigSnapshot(accountId) {
    const id = resolveAccountId(accountId);
    if (!id) return cloneAccountConfig(accountFallbackConfig);
    return normalizeAccountConfig(globalConfig.accountConfigs[id], accountFallbackConfig);
}

function setAccountConfigSnapshot(accountId, nextConfig, persist = true) {
    const id = resolveAccountId(accountId);
    if (!id) {
        accountFallbackConfig = normalizeAccountConfig(nextConfig, accountFallbackConfig);
        globalConfig.defaultAccountConfig = cloneAccountConfig(accountFallbackConfig);
        if (persist) saveGlobalConfig();
        return cloneAccountConfig(accountFallbackConfig);
    }
    globalConfig.accountConfigs[id] = normalizeAccountConfig(nextConfig, accountFallbackConfig);
    if (persist) saveGlobalConfig();
    return cloneAccountConfig(globalConfig.accountConfigs[id]);
}

function removeAccountConfig(accountId) {
    const id = resolveAccountId(accountId);
    if (!id) return;
    if (globalConfig.accountConfigs[id]) {
        delete globalConfig.accountConfigs[id];
        saveGlobalConfig();
    }
}

function ensureAccountConfig(accountId, options = {}) {
    const id = resolveAccountId(accountId);
    if (!id) return null;
    if (globalConfig.accountConfigs[id]) {
        return cloneAccountConfig(globalConfig.accountConfigs[id]);
    }
    globalConfig.accountConfigs[id] = cloneAccountConfig(DEFAULT_ACCOUNT_CONFIG);
    if (options.persist !== false) saveGlobalConfig();
    return cloneAccountConfig(globalConfig.accountConfigs[id]);
}

// 加载全局配置
function loadGlobalConfig() {
    ensureDataDir();
    try {
        const data = readJsonFile(STORE_FILE, () => ({}));
        if (data && typeof data === 'object') {
            // 先设置 accountFallbackConfig 为默认值，确保后续规范化使用正确的 fallback
            accountFallbackConfig = cloneAccountConfig(DEFAULT_ACCOUNT_CONFIG);
            globalConfig.defaultAccountConfig = cloneAccountConfig(accountFallbackConfig);

            // 加载账号配置，使用 DEFAULT_ACCOUNT_CONFIG 作为 fallback
            const cfgMap = (data.accountConfigs && typeof data.accountConfigs === 'object')
                ? data.accountConfigs
                : {};
            globalConfig.accountConfigs = {};
            for (const [id, cfg] of Object.entries(cfgMap)) {
                const sid = String(id || '').trim();
                if (!sid) continue;
                globalConfig.accountConfigs[sid] = normalizeAccountConfig(cfg, DEFAULT_ACCOUNT_CONFIG);
            }
            // 统一规范化，确保内存中不残留旧字段（如 automation.friend）
            for (const [id, cfg] of Object.entries(globalConfig.accountConfigs)) {
                globalConfig.accountConfigs[id] = normalizeAccountConfig(cfg, DEFAULT_ACCOUNT_CONFIG);
            }
            globalConfig.ui = { ...globalConfig.ui, ...(data.ui || {}) };
            const theme = String(globalConfig.ui.theme || '').toLowerCase();
            globalConfig.ui.theme = theme === 'light' ? 'light' : 'dark';
            globalConfig.offlineReminder = normalizeOfflineReminder(data.offlineReminder);

            // 加载用户隔离的下线提醒配置
            if (data.userOfflineReminders && typeof data.userOfflineReminders === 'object') {
                globalConfig.userOfflineReminders = {};
                for (const [username, cfg] of Object.entries(data.userOfflineReminders)) {
                    if (username && cfg) {
                        globalConfig.userOfflineReminders[username] = normalizeOfflineReminder(cfg);
                    }
                }
            }
            // 兼容旧版本：将全局 offlineReminder 迁移到 admin 用户（如果存在）
            if (data.offlineReminder && typeof data.offlineReminder === 'object') {
                const legacyCfg = normalizeOfflineReminder(data.offlineReminder);
                // 只有当 admin 用户没有配置时才迁移
                if (!globalConfig.userOfflineReminders.admin) {
                    globalConfig.userOfflineReminders.admin = legacyCfg;
                }
            }

            if (typeof data.adminPasswordHash === 'string') {
                globalConfig.adminPasswordHash = data.adminPasswordHash;
            }

            // 加载公告配置
            if (data.announcement && typeof data.announcement === 'object') {
                globalConfig.announcement = {
                    content: String(data.announcement.content || '').trim(),
                    showOnce: data.announcement.showOnce !== false,
                    updatedAt: Number(data.announcement.updatedAt) || 0,
                };
            }
            // 加载公告已读记录
            if (data.announcementReadRecords && typeof data.announcementReadRecords === 'object') {
                globalConfig.announcementReadRecords = { ...data.announcementReadRecords };
            }

            // 加载运行连接配置
            if (data.connectionConfig && typeof data.connectionConfig === 'object') {
                globalConfig.connectionConfig = normalizeConnectionConfig(data.connectionConfig);
            }
        }
    } catch (e) {
        console.error('加载配置失败:', e.message);
    }
}

function sanitizeGlobalConfigBeforeSave() {
    // default 配置统一白名单净化
    accountFallbackConfig = normalizeAccountConfig(globalConfig.defaultAccountConfig, DEFAULT_ACCOUNT_CONFIG);
    globalConfig.defaultAccountConfig = cloneAccountConfig(accountFallbackConfig);

    // 每个账号配置也统一净化（使用 DEFAULT_ACCOUNT_CONFIG 作为 fallback，确保新账号使用正确的默认值）
    const map = (globalConfig.accountConfigs && typeof globalConfig.accountConfigs === 'object')
        ? globalConfig.accountConfigs
        : {};
    const nextMap = {};
    for (const [id, cfg] of Object.entries(map)) {
        const sid = String(id || '').trim();
        if (!sid) continue;
        nextMap[sid] = normalizeAccountConfig(cfg, DEFAULT_ACCOUNT_CONFIG);
    }
    globalConfig.accountConfigs = nextMap;

    // 净化用户隔离的下线提醒配置
    const userReminders = (globalConfig.userOfflineReminders && typeof globalConfig.userOfflineReminders === 'object')
        ? globalConfig.userOfflineReminders
        : {};
    const nextReminders = {};
    for (const [username, cfg] of Object.entries(userReminders)) {
        const u = String(username || '').trim();
        if (!u) continue;
        nextReminders[u] = normalizeOfflineReminder(cfg);
    }
    globalConfig.userOfflineReminders = nextReminders;
}

// 保存全局配置
function saveGlobalConfig() {
    ensureDataDir();
    try {
        const oldJson = readTextFile(STORE_FILE, '');

        sanitizeGlobalConfigBeforeSave();
        const newJson = JSON.stringify(globalConfig, null, 2);

        if (oldJson !== newJson) {
            console.warn('[系统] 正在保存配置到:', STORE_FILE);
            writeJsonFileAtomic(STORE_FILE, globalConfig);
        }
    } catch (e) {
        console.error('保存配置失败:', e.message);
    }
}

function getAdminPasswordHash() {
    return String(globalConfig.adminPasswordHash || '');
}

function setAdminPasswordHash(hash) {
    globalConfig.adminPasswordHash = String(hash || '');
    saveGlobalConfig();
    return globalConfig.adminPasswordHash;
}

// 初始化加载
loadGlobalConfig();

function getAutomation(accountId) {
    // return { ...getAccountConfigSnapshot(accountId).automation };
    const automation = { ...getAccountConfigSnapshot(accountId).automation };
    automation.fertilizer_land_types = normalizeFertilizerLandTypes(automation.fertilizer_land_types);
    return automation;
}

function getConfigSnapshot(accountId) {
    const cfg = getAccountConfigSnapshot(accountId);
    return {
        automation: { ...cfg.automation },
        plantingStrategy: cfg.plantingStrategy,
        preferredSeedId: cfg.preferredSeedId,
        intervals: { ...cfg.intervals },
        friendQuietHours: { ...cfg.friendQuietHours },
        knownFriendGids: [...(cfg.knownFriendGids || [])],
        knownFriendGidSyncCooldownSec: cfg.knownFriendGidSyncCooldownSec,
        friendBlacklist: [...(cfg.friendBlacklist || [])],
        plantBlacklist: [...(cfg.plantBlacklist || [])],
        stealDelaySeconds: Math.max(0, Math.min(300, Number(cfg.stealDelaySeconds) || 0)),
        plantOrderRandom: !!cfg.plantOrderRandom,
        plantDelaySeconds: Math.max(0, Math.min(60, Number(cfg.plantDelaySeconds) || 0)),
        fertilizerBuyType: cfg.fertilizerBuyType || 'organic',
        fertilizerBuyCount: Math.max(0, Math.min(10000, Number(cfg.fertilizerBuyCount) || 0)),
        ui: { ...globalConfig.ui },
    };
}

function applyConfigSnapshot(snapshot, options = {}) {
    const cfg = snapshot || {};
    const persist = options.persist !== false;
    const accountId = options.accountId;

    const current = getAccountConfigSnapshot(accountId);
    const next = normalizeAccountConfig(current, accountFallbackConfig);

    if (cfg.automation && typeof cfg.automation === 'object') {
        for (const [k, v] of Object.entries(cfg.automation)) {
            if (next.automation[k] === undefined) continue;
            if (k === 'fertilizer') {
                const allowed = ['both', 'normal', 'organic', 'smart', 'none'];
                next.automation[k] = allowed.includes(v) ? v : next.automation[k];
            } else if (k === 'fertilizer_land_types') {
                next.automation[k] = normalizeFertilizerLandTypes(v, next.automation[k]);
            } else if (k === 'fertilizer_smart_seconds') {
                next.automation[k] = Math.max(30, Math.min(3600, Number(v) || 300));
            } else {
                next.automation[k] = !!v;
            }
        }
    }

    if (cfg.plantingStrategy && ALLOWED_PLANTING_STRATEGIES.includes(cfg.plantingStrategy)) {
        next.plantingStrategy = cfg.plantingStrategy;
    }

    if (cfg.preferredSeedId !== undefined && cfg.preferredSeedId !== null) {
        next.preferredSeedId = Math.max(0, Number.parseInt(cfg.preferredSeedId, 10) || 0);
    }

    if (cfg.intervals && typeof cfg.intervals === 'object') {
        for (const [type, sec] of Object.entries(cfg.intervals)) {
            if (next.intervals[type] === undefined) continue;
            next.intervals[type] = Math.max(1, Number.parseInt(sec, 10) || next.intervals[type] || 1);
        }
        next.intervals = normalizeIntervals(next.intervals);
    }

    if (cfg.friendQuietHours && typeof cfg.friendQuietHours === 'object') {
        const old = next.friendQuietHours || {};
        next.friendQuietHours = {
            enabled: cfg.friendQuietHours.enabled !== undefined ? !!cfg.friendQuietHours.enabled : !!old.enabled,
            start: normalizeTimeString(cfg.friendQuietHours.start, old.start || '23:00'),
            end: normalizeTimeString(cfg.friendQuietHours.end, old.end || '07:00'),
        };
    }

    if (Array.isArray(cfg.friendBlacklist)) {
        next.friendBlacklist = cfg.friendBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0);
    }

    if (cfg.knownFriendGids !== undefined) {
        next.knownFriendGids = normalizeKnownFriendGids(cfg.knownFriendGids, next.knownFriendGids);
        // 同时写入缓存文件
        if (accountId) {
            writeKnownFriendGidsCache(accountId, next.knownFriendGids);
        }
    }

    if (cfg.knownFriendGidSyncCooldownSec !== undefined) {
        next.knownFriendGidSyncCooldownSec = normalizeKnownFriendGidSyncCooldownSec(
            cfg.knownFriendGidSyncCooldownSec,
            next.knownFriendGidSyncCooldownSec,
        );
    }

    // 蔬菜黑名单
    if (Array.isArray(cfg.plantBlacklist)) {
        next.plantBlacklist = cfg.plantBlacklist.map(Number).filter(n => Number.isFinite(n) && n > 0);
    }

    // 偷取延迟
    if (cfg.stealDelaySeconds !== undefined && cfg.stealDelaySeconds !== null) {
        next.stealDelaySeconds = Math.max(0, Math.min(300, Number(cfg.stealDelaySeconds) || 0));
    }

    // 种植顺序随机
    if (cfg.plantOrderRandom !== undefined && cfg.plantOrderRandom !== null) {
        next.plantOrderRandom = !!cfg.plantOrderRandom;
    }

    // 种植延迟
    if (cfg.plantDelaySeconds !== undefined && cfg.plantDelaySeconds !== null) {
        next.plantDelaySeconds = Math.max(0, Math.min(60, Number(cfg.plantDelaySeconds) || 0));
    }

    // 化肥购买类型
    if (cfg.fertilizerBuyType !== undefined && cfg.fertilizerBuyType !== null) {
        const allowedTypes = ['organic', 'normal'];
        next.fertilizerBuyType = allowedTypes.includes(cfg.fertilizerBuyType) ? cfg.fertilizerBuyType : 'organic';
    }

    // 化肥购买数量
    if (cfg.fertilizerBuyCount !== undefined && cfg.fertilizerBuyCount !== null) {
        next.fertilizerBuyCount = Math.max(0, Math.min(10000, Number(cfg.fertilizerBuyCount) || 0));
    }

    // 背包种子优先顺序
    if (cfg.bagSeedPriority !== undefined && cfg.bagSeedPriority !== null) {
        next.bagSeedPriority = normalizeBagSeedPriority(cfg.bagSeedPriority);
    }

    // 背包种子回退策略
    if (cfg.bagSeedFallbackStrategy !== undefined && cfg.bagSeedFallbackStrategy !== null) {
        next.bagSeedFallbackStrategy = normalizeBagSeedFallbackStrategy(cfg.bagSeedFallbackStrategy);
    }

    if (cfg.ui && typeof cfg.ui === 'object') {
        const theme = String(cfg.ui.theme || '').toLowerCase();
        if (theme === 'dark' || theme === 'light') {
            globalConfig.ui.theme = theme;
        }
    }

    setAccountConfigSnapshot(accountId, next, false);
    if (persist) saveGlobalConfig();
    return getConfigSnapshot(accountId);
}

function setAutomation(key, value, accountId) {
    return applyConfigSnapshot({ automation: { [key]: value } }, { accountId });
}

function isAutomationOn(key, accountId) {
    return !!getAccountConfigSnapshot(accountId).automation[key];
}

function getPreferredSeed(accountId) {
    return getAccountConfigSnapshot(accountId).preferredSeedId;
}

function getPlantingStrategy(accountId) {
    return getAccountConfigSnapshot(accountId).plantingStrategy;
}

function getBagSeedPriority(accountId) {
    return [...(getAccountConfigSnapshot(accountId).bagSeedPriority || [])];
}

function getBagSeedFallbackStrategy(accountId) {
    return normalizeBagSeedFallbackStrategy(getAccountConfigSnapshot(accountId).bagSeedFallbackStrategy);
}

function getIntervals(accountId) {
    return { ...getAccountConfigSnapshot(accountId).intervals };
}

function normalizeIntervals(intervals) {
    const src = (intervals && typeof intervals === 'object') ? intervals : {};
    const toSec = (v, d) => Math.max(1, Number.parseInt(v, 10) || d);
    const farm = toSec(src.farm, 2);

    let farmMin = toSec(src.farmMin, farm);
    let farmMax = toSec(src.farmMax, farm);
    if (farmMin > farmMax) [farmMin, farmMax] = [farmMax, farmMin];

    // 帮助和偷菜的独立间隔，默认使用 10 秒
    let helpMin = toSec(src.helpMin, 10);
    let helpMax = toSec(src.helpMax, 10);
    if (helpMin > helpMax) [helpMin, helpMax] = [helpMax, helpMin];

    let stealMin = toSec(src.stealMin, 10);
    let stealMax = toSec(src.stealMax, 10);
    if (stealMin > stealMax) [stealMin, stealMax] = [stealMax, stealMin];

    return {
        ...src,
        farm,
        farmMin,
        farmMax,
        helpMin,
        helpMax,
        stealMin,
        stealMax,
    };
}

function normalizeTimeString(v, fallback) {
    const s = String(v || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return fallback;
    const hh = Math.max(0, Math.min(23, Number.parseInt(m[1], 10)));
    const mm = Math.max(0, Math.min(59, Number.parseInt(m[2], 10)));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getFriendQuietHours(accountId) {
    return { ...getAccountConfigSnapshot(accountId).friendQuietHours };
}

function getKnownFriendGids(accountId) {
    const config = getAccountConfigSnapshot(accountId);
    const configGids = config.knownFriendGids || [];
    
    // 如果配置中有 GID，直接返回
    if (configGids.length > 0) {
        return [...configGids];
    }
    
    // 否则尝试从缓存文件读取
    const cachedGids = readKnownFriendGidsCache(accountId);
    if (cachedGids && cachedGids.length > 0) {
        return [...cachedGids];
    }
    
    return [];
}

function setKnownFriendGids(accountId, list) {
    const current = getAccountConfigSnapshot(accountId);
    const next = normalizeAccountConfig(current, accountFallbackConfig);
    const normalizedGids = normalizeKnownFriendGids(list, next.knownFriendGids);
    next.knownFriendGids = normalizedGids;
    setAccountConfigSnapshot(accountId, next);
    
    // 同时写入缓存文件
    writeKnownFriendGidsCache(accountId, normalizedGids);
    
    return [...normalizedGids];
}

function getKnownFriendGidSyncCooldownSec(accountId) {
    return normalizeKnownFriendGidSyncCooldownSec(getAccountConfigSnapshot(accountId).knownFriendGidSyncCooldownSec);
}

function setKnownFriendGidSyncCooldownSec(accountId, sec) {
    const current = getAccountConfigSnapshot(accountId);
    const normalized = normalizeKnownFriendGidSyncCooldownSec(sec, current.knownFriendGidSyncCooldownSec);
    const next = normalizeAccountConfig({
        ...current,
        knownFriendGidSyncCooldownSec: normalized,
    }, accountFallbackConfig);
    setAccountConfigSnapshot(accountId, next, true);
    return next.knownFriendGidSyncCooldownSec;
}

function getFriendBlacklist(accountId) {
    return [...(getAccountConfigSnapshot(accountId).friendBlacklist || [])];
}

function setFriendBlacklist(accountId, list) {
    const current = getAccountConfigSnapshot(accountId);
    const next = normalizeAccountConfig(current, accountFallbackConfig);
    next.friendBlacklist = Array.isArray(list) ? list.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    setAccountConfigSnapshot(accountId, next);
    return [...next.friendBlacklist];
}

function addFriendToBlacklist(accountId, gid) {
    const gidNum = Number(gid);
    if (!gidNum || gidNum <= 0) return false;
    const current = getFriendBlacklist(accountId);
    if (current.includes(gidNum)) return false;
    const newList = [...current, gidNum];
    setFriendBlacklist(accountId, newList);
    return true;
}

// ============ 偷取延迟 ============
function getStealDelaySeconds(accountId) {
    return Math.max(0, Math.min(300, Number(getAccountConfigSnapshot(accountId).stealDelaySeconds) || 0));
}

// ============ 种植顺序随机 ============
function getPlantOrderRandom(accountId) {
    return !!getAccountConfigSnapshot(accountId).plantOrderRandom;
}

// ============ 种植延迟 ============
function getPlantDelaySeconds(accountId) {
    return Math.max(0, Math.min(60, Number(getAccountConfigSnapshot(accountId).plantDelaySeconds) || 0));
}

// ============ 化肥购买类型 ============
function getFertilizerBuyType(accountId) {
    const cfg = getAccountConfigSnapshot(accountId);
    const allowedTypes = ['organic', 'normal'];
    return allowedTypes.includes(cfg.fertilizerBuyType) ? cfg.fertilizerBuyType : 'organic';
}

// ============ 化肥购买数量 ============
function getFertilizerBuyCount(accountId) {
    return Math.max(0, Math.min(10000, Number(getAccountConfigSnapshot(accountId).fertilizerBuyCount) || 0));
}

// ============ 蔬菜黑名单 ============
function getPlantBlacklist(accountId) {
    return [...(getAccountConfigSnapshot(accountId).plantBlacklist || [])];
}

function setPlantBlacklist(accountId, list) {
    const current = getAccountConfigSnapshot(accountId);
    const next = normalizeAccountConfig(current, accountFallbackConfig);
    next.plantBlacklist = Array.isArray(list) ? list.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    setAccountConfigSnapshot(accountId, next);
    return [...next.plantBlacklist];
}

function getUI() {
    return { ...globalConfig.ui };
}

function setUITheme(theme) {
    const t = String(theme || '').toLowerCase();
    const next = (t === 'light') ? 'light' : 'dark';
    return applyConfigSnapshot({ ui: { theme: next } });
}

// ============ 用户隔离的下线提醒配置 ============
function getOfflineReminder(username) {
    // 必须指定用户名，按用户隔离
    if (!username) {
        return normalizeOfflineReminder(globalConfig.offlineReminder);
    }
    const userCfg = globalConfig.userOfflineReminders && globalConfig.userOfflineReminders[username];
    if (userCfg) {
        return normalizeOfflineReminder(userCfg);
    }
    // 用户未设置时返回默认配置（但不保存到全局）
    return normalizeOfflineReminder({});
}

function setOfflineReminder(cfg, username) {
    // 必须指定用户名，按用户隔离
    if (!username) {
        // 兼容旧版本：如果没有指定用户名，保存到全局配置
        const current = normalizeOfflineReminder(globalConfig.offlineReminder);
        globalConfig.offlineReminder = normalizeOfflineReminder({ ...current, ...(cfg || {}) });
        saveGlobalConfig();
        return getOfflineReminder();
    }
    if (!globalConfig.userOfflineReminders) {
        globalConfig.userOfflineReminders = {};
    }
    const current = normalizeOfflineReminder(globalConfig.userOfflineReminders[username] || {});
    globalConfig.userOfflineReminders[username] = normalizeOfflineReminder({ ...current, ...(cfg || {}) });
    saveGlobalConfig();
    return getOfflineReminder(username);
}

function deleteUserOfflineReminder(username) {
    if (globalConfig.userOfflineReminders && globalConfig.userOfflineReminders[username]) {
        delete globalConfig.userOfflineReminders[username];
        saveGlobalConfig();
    }
}

// ============ 账号级别的下线提醒配置 ============
/**
 * 获取账号级别的下线提醒配置
 * @param {string} accountId - 账号 ID
 * @returns {object|null} 配置对象或 null
 */
function getAccountOfflineReminder(accountId) {
    const id = resolveAccountId(accountId);
    if (!id) return null;
    const cfg = globalConfig.accountConfigs[id];
    if (!cfg || cfg.offlineReminder === undefined) return null;
    return cfg.offlineReminder;
}

/**
 * 设置账号级别的下线提醒配置
 * @param {string} accountId - 账号 ID
 * @param {object|null} cfg - 配置对象，null 表示删除配置
 * @returns {object|null} 保存后的配置
 */
function setAccountOfflineReminder(accountId, cfg) {
    const id = resolveAccountId(accountId);
    if (!id) return null;
    
    ensureAccountConfig(id, { persist: false });
    
    if (cfg === null || cfg === undefined) {
        globalConfig.accountConfigs[id].offlineReminder = null;
    } else {
        globalConfig.accountConfigs[id].offlineReminder = normalizeOfflineReminder(cfg);
    }
    
    saveGlobalConfig();
    return globalConfig.accountConfigs[id].offlineReminder;
}

/**
 * 获取有效的下线提醒配置（按优先级查找）
 * @param {string} accountId - 账号 ID
 * @param {string} username - 用户名
 * @returns {object} 有效的配置对象
 */
function getEffectiveOfflineReminder(accountId, username) {
    // 1. 检查账号级别配置
    const accountCfg = getAccountOfflineReminder(accountId);
    if (accountCfg) return accountCfg;
    
    // 2. 检查用户级别配置
    if (username) {
        const userCfg = getOfflineReminder(username);
        if (userCfg && globalConfig.userOfflineReminders && globalConfig.userOfflineReminders[username]) {
            return userCfg;
        }
    }
    
    // 3. 返回全局配置
    return normalizeOfflineReminder(globalConfig.offlineReminder);
}

// ============ 账号管理 ============
function loadAccounts() {
    ensureDataDir();
    const data = readJsonFile(ACCOUNTS_FILE, () => ({ accounts: [], nextId: 1 }));
    return normalizeAccountsData(data);
}

function saveAccounts(data) {
    ensureDataDir();
    writeJsonFileAtomic(ACCOUNTS_FILE, normalizeAccountsData(data));
}

function getAccounts() {
    return loadAccounts();
}

function normalizeAccountsData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const maxId = accounts.reduce((m, a) => Math.max(m, Number.parseInt(a && a.id, 10) || 0), 0);
    let nextId = Number.parseInt(data.nextId, 10);
    if (!Number.isFinite(nextId) || nextId <= 0) nextId = maxId + 1;
    if (accounts.length === 0) nextId = 1;
    if (nextId <= maxId) nextId = maxId + 1;
    return { accounts, nextId };
}

function addOrUpdateAccount(acc) {
    const data = normalizeAccountsData(loadAccounts());
    let touchedAccountId = '';
    if (acc.id) {
        const idx = data.accounts.findIndex(a => a.id === acc.id);
        if (idx >= 0) {
            data.accounts[idx] = { ...data.accounts[idx], ...acc, name: acc.name !== undefined ? acc.name : data.accounts[idx].name, updatedAt: Date.now() };
            touchedAccountId = String(data.accounts[idx].id || '');
        }
    } else {
        const id = data.nextId++;
        touchedAccountId = String(id);
        data.accounts.push({
            id: touchedAccountId,
            name: acc.name || `账号${id}`,
            code: acc.code || '',
            platform: acc.platform || 'qq',
            uin: acc.uin ? String(acc.uin) : '',
            qq: acc.qq ? String(acc.qq) : (acc.uin ? String(acc.uin) : ''),
            avatar: acc.avatar || acc.avatarUrl || '',
            username: acc.username || '', // 保存用户名字段
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }
    saveAccounts(data);
    if (touchedAccountId) {
        ensureAccountConfig(touchedAccountId);
    }
    return data;
}

function deleteAccount(id) {
    const data = normalizeAccountsData(loadAccounts());
    data.accounts = data.accounts.filter(a => a.id !== String(id));
    if (data.accounts.length === 0) {
        data.nextId = 1;
    }
    saveAccounts(data);
    removeAccountConfig(id);
    return data;
}

// ============ 用户隔离支持 ============
function getAccountsByUser(username) {
    const allAccounts = loadAccounts();
    if (!username) return allAccounts;
    return {
        accounts: allAccounts.accounts.filter(a => a.username === username),
        nextId: allAccounts.nextId
    };
}

function deleteAccountsByUser(username) {
    const data = loadAccounts();
    const deletedIds = [];
    data.accounts = data.accounts.filter(a => {
        if (a.username === username) {
            deletedIds.push(a.id);
            return false;
        }
        return true;
    });
    if (data.accounts.length === 0) {
        data.nextId = 1;
    }
    saveAccounts(data);
    // 清理被删除账号的配置
    deletedIds.forEach(id => removeAccountConfig(id));
    return { deletedCount: deletedIds.length, deletedIds };
}

function deleteUserConfig(username) {
    // 删除用户特定的配置
    deleteUserOfflineReminder(username);
}

function getDefaultAccountConfig() {
    return cloneAccountConfig(DEFAULT_ACCOUNT_CONFIG);
}

// ============ 公告管理 ============
function getAnnouncement() {
    return {
        content: globalConfig.announcement?.content || '',
        showOnce: globalConfig.announcement?.showOnce ?? true,
        updatedAt: globalConfig.announcement?.updatedAt || 0,
    };
}

function setAnnouncement(content, showOnce = true) {
    globalConfig.announcement = {
        content: String(content || '').trim(),
        showOnce: !!showOnce,
        updatedAt: Date.now(),
    };
    saveGlobalConfig();
    return getAnnouncement();
}

function getAnnouncementReadRecord(username) {
    if (!username) return 0;
    return globalConfig.announcementReadRecords?.[username] || 0;
}

function markAnnouncementRead(username) {
    if (!username) return;
    if (!globalConfig.announcementReadRecords) {
        globalConfig.announcementReadRecords = {};
    }
    globalConfig.announcementReadRecords[username] = Date.now();
    saveGlobalConfig();
}

function shouldShowAnnouncement(username) {
    const announcement = getAnnouncement();
    if (!announcement.content) return false;
    if (!username) return false;
    if (!announcement.showOnce) return true;
    const readAt = getAnnouncementReadRecord(username);
    return readAt < announcement.updatedAt;
}

// ============ 运行连接配置 ============
function normalizeConnectionConfig(input) {
    const { DEFAULT_CONNECTION_CONFIG } = require('../config/config');
    const src = (input && typeof input === 'object') ? input : {};
    return {
        serverUrl: String(src.serverUrl || DEFAULT_CONNECTION_CONFIG.serverUrl).trim(),
        clientVersion: String(src.clientVersion || DEFAULT_CONNECTION_CONFIG.clientVersion).trim(),
        platform: String(src.platform || DEFAULT_CONNECTION_CONFIG.platform).trim(),
        os: String(src.os || DEFAULT_CONNECTION_CONFIG.os).trim(),
        sysSoftware: String(src.sysSoftware || DEFAULT_CONNECTION_CONFIG.sysSoftware).trim(),
        network: String(src.network || DEFAULT_CONNECTION_CONFIG.network).trim(),
        memory: String(src.memory || DEFAULT_CONNECTION_CONFIG.memory).trim(),
        deviceId: String(src.deviceId || DEFAULT_CONNECTION_CONFIG.deviceId).trim(),
    };
}

function getConnectionConfig() {
    const { DEFAULT_CONNECTION_CONFIG } = require('../config/config');
    if (!globalConfig.connectionConfig) {
        return { ...DEFAULT_CONNECTION_CONFIG };
    }
    return { ...globalConfig.connectionConfig };
}

function saveConnectionConfig(config) {
    globalConfig.connectionConfig = normalizeConnectionConfig(config);
    saveGlobalConfig();
}

function resetConnectionConfig() {
    globalConfig.connectionConfig = null;
    saveGlobalConfig();
}

module.exports = {
    getConfigSnapshot,
    applyConfigSnapshot,
    getAutomation,
    setAutomation,
    isAutomationOn,
    getPreferredSeed,
    getPlantingStrategy,
    getBagSeedPriority,
    getBagSeedFallbackStrategy,
    getIntervals,
    getFriendQuietHours,
    getKnownFriendGids,
    setKnownFriendGids,
    getKnownFriendGidSyncCooldownSec,
    setKnownFriendGidSyncCooldownSec,
    getFriendBlacklist,
    setFriendBlacklist,
    addFriendToBlacklist,
    getStealDelaySeconds,
    getPlantOrderRandom,
    getPlantDelaySeconds,
    getFertilizerBuyType,
    getFertilizerBuyCount,
    getUI,
    setUITheme,
    getOfflineReminder,
    setOfflineReminder,
    deleteUserOfflineReminder,
    getAccountOfflineReminder,
    setAccountOfflineReminder,
    getEffectiveOfflineReminder,
    getAccounts,
    addOrUpdateAccount,
    deleteAccount,
    getAdminPasswordHash,
    setAdminPasswordHash,
    // 用户隔离支持
    getAccountsByUser,
    deleteAccountsByUser,
    deleteUserConfig,
    // 蔬菜黑名单
    getPlantBlacklist,
    setPlantBlacklist,
    // 默认配置
    getDefaultAccountConfig,
    // 公告管理
    getAnnouncement,
    setAnnouncement,
    getAnnouncementReadRecord,
    markAnnouncementRead,
    shouldShowAnnouncement,
    // 运行连接配置
    getConnectionConfig,
    saveConnectionConfig,
    resetConnectionConfig,
};
