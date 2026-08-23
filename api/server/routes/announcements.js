const express = require('express');
const mongoose = require('mongoose');
const { requireJwtAuth } = require('~/server/middleware');
const { normalizeAnnouncement, isVisibleAnnouncement, sortAnnouncements } = require('./announcement-utils');
const {
  getAnnouncementReadModel,
  getReadAnnouncementIds,
  markAnnouncementsRead,
  addUnreadFlags,
} = require('./announcement-read');

const router = express.Router();

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
const AnnouncementRead = getAnnouncementReadModel(mongoose);

function canManageAnnouncements(user) {
  return user?.role === 'ADMIN' || user?.role === 'DELEGATED_ADMIN' || user?.isAdmin === true;
}

const requireAdminAccess = (req, res, next) => {
  if (canManageAnnouncements(req.user)) return next();
  return res.status(403).json({ error: 'Administrator access required' });
};

function publicAnnouncement(item) {
  const value = item.toObject ? item.toObject() : item;
  delete value.createdBy;
  return value;
}

router.get('/', requireJwtAuth, async (req, res, next) => {
  try {
    const all = canManageAnnouncements(req.user) && req.query.all === 'true';
    const items = await Announcement.find(all ? {} : { active: true, publishAt: { $lte: new Date() } })
      .sort({ pinned: -1, publishAt: -1 })
      .lean();
    const visible = all ? items : items.filter((item) => isVisibleAnnouncement(item));
    const readIds = await getReadAnnouncementIds(AnnouncementRead, req.user.id);
    res.json(sortAnnouncements(addUnreadFlags(visible.map(publicAnnouncement), readIds)));
  } catch (error) {
    next(error);
  }
});

router.post('/read', requireJwtAuth, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.announcementIds)) {
      return res.status(400).json({ error: 'announcementIds must be an array' });
    }

    const visibleItems = await Announcement.find({ active: true, publishAt: { $lte: new Date() } })
      .select({ _id: 1, active: 1, publishAt: 1 })
      .lean();
    const visibleIds = new Set(
      visibleItems.filter((item) => isVisibleAnnouncement(item)).map((item) => item._id.toString()),
    );
    await markAnnouncementsRead(
      AnnouncementRead,
      req.user.id,
      req.body.announcementIds.map(String),
      visibleIds,
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireJwtAuth, async (req, res, next) => {
  try {
    const item = await Announcement.findById(req.params.id).lean();
    if (!item || (!isVisibleAnnouncement(item) && !canManageAnnouncements(req.user))) {
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
