const express = require('express');
const {
  createImageGenerationController,
  imageGenerationBodyErrorHandler,
} = require('@librechat/api');
const { getUserKey } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const imageGenerationController = createImageGenerationController({ getUserKey });
const imageBodyLimit = process.env.AITTCO_IMAGE_MAX_INPUT_BYTES
  ? /^\d+$/.test(process.env.AITTCO_IMAGE_MAX_INPUT_BYTES)
    ? `${process.env.AITTCO_IMAGE_MAX_INPUT_BYTES}b`
    : process.env.AITTCO_IMAGE_MAX_INPUT_BYTES
  : '80mb';

// Reference images are validated by the TypeScript controller. Keep parsing
// scoped to this endpoint and reject oversized payloads before controller work.
router.post(
  '/generate',
  requireJwtAuth,
  express.json({ limit: imageBodyLimit }),
  imageGenerationBodyErrorHandler,
  imageGenerationController,
);

module.exports = router;
