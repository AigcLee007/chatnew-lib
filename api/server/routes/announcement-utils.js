function normalizeAnnouncement(input = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!title) throw new Error('title is required');
  if (!content) throw new Error('content is required');
  return {
    title,
    content,
    active: input.active !== false,
    pinned: input.pinned === true,
    publishAt: input.publishAt ? new Date(input.publishAt) : new Date(),
  };
}

function isVisibleAnnouncement(item, now = new Date()) {
  return item.active !== false && new Date(item.publishAt || 0).getTime() <= now.getTime();
}

function sortAnnouncements(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.publishAt || b.createdAt || 0) - new Date(a.publishAt || a.createdAt || 0);
  });
}

module.exports = { normalizeAnnouncement, isVisibleAnnouncement, sortAnnouncements };
