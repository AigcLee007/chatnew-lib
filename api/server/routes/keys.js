const express = require('express');
const { updateUserKey, deleteUserKey, getUserKeyExpiry } = require('~/models');
const { getUserKeyValues } = require('~/models');
const axios = require('axios');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const AITTCO_SHARED_KEY_NAME = 'aittco_shared';
const QUOTA_CACHE_TTL_MS = 60 * 1000;
const quotaCache = new Map();
const quotaPaths = [
  '/api/key/balance',
  '/api/token/self',
  '/api/user/self',
  '/api/user/token',
  '/v1/dashboard/billing/credit_grants',
  '/dashboard/billing/credit_grants',
  '/v1/billing/credit_grants',
  '/v1/dashboard/billing/subscription',
  '/dashboard/billing/subscription',
  '/v1/billing/subscription',
  '/v1/dashboard/billing/usage',
  '/dashboard/billing/usage',
  '/v1/models',
];

function normalizeQuota(data) {
  if (!data || typeof data !== 'object') return null;
  const values = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    values.push(value);
    Object.values(value).forEach((child) => {
      if (child && typeof child === 'object') visit(child);
    });
  };
  visit(data);
  const numberFor = (keys) => {
    for (const value of values) {
      for (const key of keys) {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
          const number = Number(value[key]);
          if (Number.isFinite(number)) return number;
        }
      }
    }
    return null;
  };
  const total = numberFor(['total', 'quota', 'total_quota', 'total_available', 'total_granted', 'grant_amount', 'hard_limit_usd', 'hard_limit', 'quota_total', 'balance_total']);
  const rawUsed = numberFor(['used', 'usage', 'used_quota', 'total_usage', 'total_used', 'used_amount', 'quota_used', 'balance_used', 'consumed_amount']);
  const used = values.some((value) => value.total_usage !== undefined) && !values.some((value) => value.used !== undefined || value.usage !== undefined)
    ? (rawUsed == null ? null : rawUsed / 100)
    : rawUsed;
  const remaining = numberFor(['remaining', 'remain', 'balance', 'available', 'available_quota', 'remain_quota', 'residual_quota', 'remaining_amount', 'quota_remaining', 'balance_remaining', 'available_amount']);
  if (![total, used, remaining].some((value) => Number.isFinite(value))) return null;
  return { total, used, remaining };
}

async function fetchAittcoQuota(apiKey) {
  const baseUrl = (process.env.AITTCO_API_URL || 'https://api.aittco.com').replace(/\/$/, '');
  const config = { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 };
  const today = new Date().toISOString().slice(0, 10);
  const usageStart = '2023-01-01';
  const paths = quotaPaths.map((path) =>
    path.includes('/usage') ? `${path}?start_date=${usageStart}&end_date=${today}` : path,
  );
  let lastError;
  let quota = null;
  for (const path of paths) {
    try {
      const response = await axios.get(`${baseUrl}${path}`, config);
      const normalized = normalizeQuota(response.data);
      if (normalized) quota = { ...(quota || {}), ...normalized };
    } catch (error) {
      lastError = error;
    }
  }
  if (quota) {
    const total = Number(quota.total);
    const used = Number(quota.used);
    const remaining = Number(quota.remaining);
    const safeTotal = Number.isFinite(total)
      ? total
      : Number.isFinite(used) && Number.isFinite(remaining)
        ? used + remaining
        : Number.isFinite(remaining)
          ? remaining
          : used;
    const safeUsed = Number.isFinite(used)
      ? used
      : Number.isFinite(remaining)
        ? Math.max(0, safeTotal - remaining)
        : 0;
    const safeRemaining = Number.isFinite(remaining)
      ? remaining
      : Math.max(0, safeTotal - safeUsed);
    return {
      total: safeTotal,
      used: safeUsed,
      remaining: safeRemaining,
      percentage: safeTotal > 0 ? Math.round((safeUsed / safeTotal) * 10000) / 100 : 0,
    };
  }
  throw lastError || new Error('Quota response was unavailable');
}

router.get('/aittco/quota', requireJwtAuth, async (req, res) => {
  const userId = req.user.id;
  const cached = quotaCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return res.status(200).send(cached.value);
  try {
    const values = await getUserKeyValues({ userId, name: AITTCO_SHARED_KEY_NAME });
    const apiKey = typeof values === 'string' ? values : values?.apiKey || values?.key || values?.value;
    if (!apiKey || apiKey === 'user_provided') {
      return res.status(404).send({ error: 'Aittco API key is not configured.' });
    }
    const quota = await fetchAittcoQuota(apiKey);
    quotaCache.set(userId, { expiresAt: Date.now() + QUOTA_CACHE_TTL_MS, value: quota });
    return res.status(200).send(quota);
  } catch (error) {
    if (error?.message === 'no user key' || /NO_USER_KEY|not found/i.test(error?.message || '')) {
      return res.status(404).send({ error: 'Aittco API key is not configured.' });
    }
    return res.status(502).send({ error: 'Unable to query Aittco API key quota.' });
  }
});

router.put('/', requireJwtAuth, async (req, res) => {
  if (req.body == null || typeof req.body !== 'object') {
    return res.status(400).send({ error: 'Invalid request body.' });
  }
  const { name, value, expiresAt } = req.body;
  await updateUserKey({ userId: req.user.id, name, value, expiresAt });
  res.status(201).send();
});

router.delete('/:name', requireJwtAuth, async (req, res) => {
  const { name } = req.params;
  await deleteUserKey({ userId: req.user.id, name });
  res.status(204).send();
});

router.delete('/', requireJwtAuth, async (req, res) => {
  const { all } = req.query;

  if (all !== 'true') {
    return res.status(400).send({ error: 'Specify either all=true to delete.' });
  }

  await deleteUserKey({ userId: req.user.id, all: true });

  res.status(204).send();
});

router.get('/', requireJwtAuth, async (req, res) => {
  const { name } = req.query;
  const response = await getUserKeyExpiry({ userId: req.user.id, name });
  res.status(200).send(response);
});

module.exports = router;
