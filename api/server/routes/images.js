const express = require('express');
const {
  createImageGenerationController,
  imageGenerationBodyErrorHandler,
} = require('@librechat/api');
const { getUserKey } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const imageGenerationController = createImageGenerationController({ getUserKey });

// Reference images are validated by the TypeScript controller. Keep parsing
// scoped to this endpoint and reject oversized payloads before controller work.
router.post(
  '/generate',
  requireJwtAuth,
  express.json({ limit: '60mb' }),
  imageGenerationBodyErrorHandler,
  imageGenerationController,
);

module.exports = router;
