const mongoose = require('mongoose');
const { isVisibleAnnouncement } = require('./announcement-utils');

const announcementReadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Announcement',
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

announcementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

function getAnnouncementReadModel(mongooseInstance) {
  return (
    mongooseInstance.models.AnnouncementRead ||
    mongooseInstance.model('AnnouncementRead', announcementReadSchema)
  );
}

function addUnreadFlags(items, readIds, now = new Date()) {
  return items.map((item) => ({
    ...item,
    unread: isVisibleAnnouncement(item, now) && !readIds.has(item._id.toString()),
  }));
}

async function getReadAnnouncementIds(ReadModel, userId) {
  const rows = await ReadModel.find({ userId }, { announcementId: 1 }).lean();
  return new Set(rows.map((row) => row.announcementId.toString()));
}

async function markAnnouncementsRead(ReadModel, userId, announcementIds, visibleIds) {
  const operations = [...new Set(announcementIds)]
    .filter((id) => visibleIds.has(id))
    .map((announcementId) => ({
      updateOne: {
        filter: { userId, announcementId },
        update: { $set: { readAt: new Date() } },
        upsert: true,
      },
    }));

  if (operations.length > 0) {
    try {
      await ReadModel.bulkWrite(operations, { ordered: false });
    } catch (error) {
      const writeErrors = error?.writeErrors;
      if (
        Array.isArray(writeErrors) &&
        writeErrors.length > 0 &&
        writeErrors.every((writeError) => writeError.code === 11000)
      ) {
        return;
      }
      throw error;
    }
  }
}

module.exports = {
  getAnnouncementReadModel,
  getReadAnnouncementIds,
  markAnnouncementsRead,
  addUnreadFlags,
};
