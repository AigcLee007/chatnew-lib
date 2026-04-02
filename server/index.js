import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../announcement.json');
const ADMIN_KEY = process.env.ADMIN_KEY || 'sk-K9OJf52OughwT8vizrDKJpvMebzutpbKVXxxhYe8EZFF0nm7';
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const AITTCO_BASE = 'https://api.aittco.com';

// --- Middleware: Auth ---
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_KEY}`) {
        return next();
    }
    return res.status(401).json({ message: '管理员 API Key 无效' });
};

// --- Helpers ---
const readData = async () => {
    try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (err) {
        return [];
    }
};

const writeData = async (data) => {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

const extractRateLimit = (headers) => {
    const pick = (name) => headers.get(name) || headers.get(name.toLowerCase()) || null;
    return {
        limitRequests: pick('x-ratelimit-limit-requests'),
        remainingRequests: pick('x-ratelimit-remaining-requests'),
        limitTokens: pick('x-ratelimit-limit-tokens'),
        remainingTokens: pick('x-ratelimit-remaining-tokens'),
        resetRequests: pick('x-ratelimit-reset-requests'),
        resetTokens: pick('x-ratelimit-reset-tokens'),
    };
};

const collectNumericCandidates = (obj, targetKeys, collector = []) => {
    if (!obj || typeof obj !== 'object') return collector;

    for (const [k, v] of Object.entries(obj)) {
        if (targetKeys.includes(k) && (typeof v === 'number' || typeof v === 'string')) {
            collector.push(v);
        }
        if (v && typeof v === 'object') {
            collectNumericCandidates(v, targetKeys, collector);
        }
    }
    return collector;
};

const pickFirstNumber = (values) => {
    for (const v of values) {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
    }
    return null;
};

const normalizeQuotaPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const totalCandidates = collectNumericCandidates(payload, [
        'quota',
        'total_quota',
        'total_available',
        'total_granted',
        'grant_amount',
        'hard_limit_usd',
        'hard_limit',
        'quota_total',
        'balance_total',
    ]);
    const usedCandidates = collectNumericCandidates(payload, [
        'used',
        'used_quota',
        'total_used',
        'used_amount',
        'quota_used',
        'balance_used',
        'consumed_amount',
    ]);
    const remainingCandidates = collectNumericCandidates(payload, [
        'remain',
        'remain_quota',
        'residual_quota',
        'available_quota',
        'remaining_amount',
        'quota_remaining',
        'balance_remaining',
        'available_amount',
        'total_available',
    ]);
    const expireCandidates = collectNumericCandidates(payload, [
        'expires_at',
        'expire_at',
        'access_until',
        'expired_at',
    ]);

    let total = pickFirstNumber(totalCandidates);
    const used = pickFirstNumber(usedCandidates);
    let remaining = pickFirstNumber(remainingCandidates);
    let expiresAt = pickFirstNumber(expireCandidates);

    if (total == null && remaining != null && used != null) {
        total = remaining + used;
    }
    if (remaining == null && total != null && used != null) {
        remaining = total - used;
    }
    if (expiresAt != null && expiresAt <= 0) {
        expiresAt = null;
    }

    if (total == null && used == null && remaining == null && expiresAt == null) return null;

    return {
        total,
        used,
        remaining,
        expiresAt,
    };
};

const mergeQuota = (base, next) => {
    if (!next) return base;
    if (!base) return { ...next };
    return {
        total: base.total ?? next.total ?? null,
        used: base.used ?? next.used ?? null,
        remaining: base.remaining ?? next.remaining ?? null,
        expiresAt: base.expiresAt ?? next.expiresAt ?? null,
    };
};

const requestWithKey = async (apiKey, path) => {
    const res = await fetch(`${AITTCO_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    return {
        ok: res.ok,
        status: res.status,
        json,
        text,
        rateLimit: extractRateLimit(res.headers),
    };
};

// --- Endpoints ---

// 0. POST /api/key-info (quota/balance lookup)
app.post('/api/key-info', async (req, res) => {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: 'API Key 格式错误' });
    }

    try {
        // Try common billing/token endpoints first (some relay keys cannot access /v1/models).
        const today = new Date();
        const startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        const candidates = [
            '/api/token/self',
            '/api/user/self',
            '/api/user/token',
            '/v1/dashboard/billing/credit_grants',
            '/dashboard/billing/credit_grants',
            '/v1/billing/credit_grants',
            '/v1/dashboard/billing/subscription',
            '/dashboard/billing/subscription',
            '/v1/billing/subscription',
            `/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            `/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            '/api/key/balance',
        ];

        let quota = null;
        const rawBilling = [];
        let validByBillingEndpoint = false;
        for (const path of candidates) {
            const billingResp = await requestWithKey(apiKey, path);
            if (billingResp.ok && billingResp.json) {
                validByBillingEndpoint = true;
                const normalized = normalizeQuotaPayload(billingResp.json);
                rawBilling.push({ path, status: billingResp.status, body: billingResp.json });
                if (normalized) {
                    quota = mergeQuota(quota, normalized);
                }
            }
        }

        // Try to complete missing fields by arithmetic.
        if (quota) {
            const totalNum = Number(quota.total);
            const usedNum = Number(quota.used);
            const remainNum = Number(quota.remaining);

            if (Number.isFinite(totalNum) && Number.isFinite(remainNum) && !Number.isFinite(usedNum)) {
                quota.used = totalNum - remainNum;
            }
            if (Number.isFinite(totalNum) && Number.isFinite(usedNum) && !Number.isFinite(remainNum)) {
                quota.remaining = totalNum - usedNum;
            }
            if (!Number.isFinite(totalNum) && Number.isFinite(usedNum) && Number.isFinite(remainNum)) {
                quota.total = usedNum + remainNum;
            }
        }

        // Optional model probe for validity/rate-limit headers.
        const modelsResp = await requestWithKey(apiKey, '/v1/models');
        const valid = validByBillingEndpoint || modelsResp.ok;

        if (!valid) {
            return res.status(modelsResp.status || 401).json({
                message: '密钥无效或暂不可用',
                detail: modelsResp.json || modelsResp.text || null,
            });
        }

        return res.json({
            valid,
            quota,
            rateLimit: modelsResp.ok ? modelsResp.rateLimit : null,
            billingRaw: rawBilling.length > 0 ? rawBilling : null,
        });
    } catch (error) {
        return res.status(500).json({
            message: '查询失败，请稍后重试',
            detail: error instanceof Error ? error.message : String(error),
        });
    }
});

// 1. GET /api/announcements (List)
app.get('/api/announcements', async (req, res) => {
    const { page = 1, pageSize = 10, search = '', all = '0' } = req.query;
    
    // Auth check if all=1
    if (all === '1') {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${ADMIN_KEY}`) {
            return res.status(401).json({ message: '管理员 API Key 无效' });
        }
    }

    let data = await readData();

    // Filter by active status (unless all=1)
    if (all !== '1') {
        data = data.filter(n => n.active);
    }

    // Search
    if (search) {
        const s = search.toLowerCase();
        data = data.filter(n => 
            n.title.toLowerCase().includes(s) || 
            n.content.toLowerCase().includes(s)
        );
    }

    // Sorting: Pinned first, then Date desc
    data.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });

    // Pagination
    const total = data.length;
    const startIndex = (page - 1) * pageSize;
    const items = data.slice(startIndex, startIndex + parseInt(pageSize));

    res.json({
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        items
    });
});

// 2. GET /api/announcement (Top single)
app.get('/api/announcement', async (req, res) => {
    const data = await readData();
    const active = data.filter(n => n.active);
    
    if (active.length === 0) return res.json(null);

    // Sort: Pinned first, then Date desc
    active.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });

    res.json(active[0]);
});

// 3. POST /api/announcement (Create)
app.post('/api/announcement', adminAuth, async (req, res) => {
    const { title, content, active = true, pinned = false } = req.body;
    const data = await readData();
    
    const newNotice = {
        id: Date.now().toString(),
        title,
        content,
        active,
        pinned,
        date: new Date().toISOString()
    };

    data.unshift(newNotice);
    await writeData(data);
    res.status(201).json(newNotice);
});

// 4. PATCH /api/announcement/:id (Update)
app.patch('/api/announcement/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const data = await readData();
    
    const index = data.findIndex(n => n.id === id);
    if (index === -1) return res.status(404).json({ message: '公告不存在' });

    data[index] = { ...data[index], ...updates };
    await writeData(data);
    res.json(data[index]);
});

// 5. DELETE /api/announcement/:id (Delete)
app.delete('/api/announcement/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const data = await readData();
    
    const filtered = data.filter(n => n.id !== id);
    if (filtered.length === data.length) return res.status(404).json({ message: '公告不存在' });

    await writeData(filtered);
    res.json({ success: true });
});

// Serve built frontend in production containers.
if (fsSync.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        return res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
    console.log(`Aittco server running on http://localhost:${PORT}`);
});
