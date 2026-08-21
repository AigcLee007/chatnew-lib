const express = require('express');
const mongoose = require('mongoose');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { normalizeAnnouncement, isVisibleAnnouncement, sortAnnouncements } = require('./announcement-utils');

const router = express.Router();
const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    active: { type: Boolean, default: true },
    pinned: { type: Boolean, default: false },
    publishAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
announcementSchema.index({ active: 1, pinned: -1, publishAt: -1 });
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

function publicAnnouncement(item) {
  const value = item.toObject ? item.toObject() : item;
  delete value.createdBy;
  return value;
}

router.get('/', requireJwtAuth, async (req, res, next) => {
  try {
    const all = req.user?.role === 'ADMIN' && req.query.all === 'true';
    const items = await Announcement.find(all ? {} : { active: true, publishAt: { $lte: new Date() } })
      .sort({ pinned: -1, publishAt: -1 })
      .lean();
    const visible = all ? items : items.filter((item) => isVisibleAnnouncement(item));
    res.json(sortAnnouncements(visible).map(publicAnnouncement));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireJwtAuth, async (req, res, next) => {
  try {
    const item = await Announcement.findById(req.params.id).lean();
    if (!item || (!isVisibleAnnouncement(item) && req.user?.role !== 'ADMIN')) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(publicAnnouncement(item));
  } catch (error) {
    next(error);
  }
});

router.use(requireJwtAuth, requireAdminAccess);

router.post('/', async (req, res, next) => {
  try {
    const data = normalizeAnnouncement(req.body);
    const item = await Announcement.create({ ...data, createdBy: req.user.id });
    res.status(201).json(publicAnnouncement(item));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const current = await Announcement.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Announcement not found' });
    const data = normalizeAnnouncement({
      title: req.body.title ?? current.title,
      content: req.body.content ?? current.content,
      active: req.body.active ?? current.active,
      pinned: req.body.pinned ?? current.pinned,
      publishAt: req.body.publishAt ?? current.publishAt,
    });
    const item = await Announcement.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Announcement not found' });
    res.json(publicAnnouncement(item));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await Announcement.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Announcement not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
