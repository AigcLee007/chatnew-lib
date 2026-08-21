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
];

function normalizeQuota(data) {
  const source = data?.data && typeof data.data === 'object' ? data.data : data || {};
  const total = Number(source.total ?? source.total_quota ?? source.quota ?? source.credit_grants ?? 0);
  const used = Number(source.used ?? source.usage ?? source.used_quota ?? 0);
  const remaining = Number(source.remaining ?? source.remain ?? source.balance ?? source.available ?? total - used);
  const hasTotal = Number.isFinite(total) && total > 0;
  const hasUsed = Number.isFinite(used) && used >= 0;
  const hasRemaining = Number.isFinite(remaining) && remaining >= 0;
  if (!hasTotal && !hasUsed && !hasRemaining) return null;
  const safeTotal = hasTotal ? total : (hasUsed && hasRemaining ? used + remaining : remaining);
  const safeUsed = hasUsed ? used : Math.max(0, safeTotal - remaining);
  const safeRemaining = hasRemaining ? remaining : Math.max(0, safeTotal - safeUsed);
  return {
    total: safeTotal,
    used: safeUsed,
    remaining: safeRemaining,
    percentage: safeTotal > 0 ? Math.round((safeUsed / safeTotal) * 10000) / 100 : 0,
  };
}

async function fetchAittcoQuota(apiKey) {
  const baseUrl = (process.env.AITTCO_API_URL || 'https://api.aittco.com').replace(/\/$/, '');
  const config = { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 };
  let lastError;
  for (const path of quotaPaths) {
    try {
      const response = await axios.get(`${baseUrl}${path}`, config);
      const normalized = normalizeQuota(response.data);
      if (normalized) return normalized;
    } catch (error) {
      lastError = error;
    }
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
