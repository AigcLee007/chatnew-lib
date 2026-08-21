const { normalizeAnnouncement, sortAnnouncements, isVisibleAnnouncement } = require('./announcement-utils');

describe('announcement-utils', () => {
  it('normalizes user supplied announcement fields', () => {
    expect(
      normalizeAnnouncement({ title: '  Hello ', content: '  body ', active: false, pinned: true }),
    ).toEqual(expect.objectContaining({ title: 'Hello', content: 'body', active: false, pinned: true }));
  });

  it('rejects empty titles and content', () => {
    expect(() => normalizeAnnouncement({ title: ' ', content: 'body' })).toThrow('title');
    expect(() => normalizeAnnouncement({ title: 'title', content: ' ' })).toThrow('content');
  });

  it('only exposes active announcements whose publish time has arrived', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    expect(isVisibleAnnouncement({ active: true, publishAt: new Date('2026-08-20') }, now)).toBe(true);
    expect(isVisibleAnnouncement({ active: false, publishAt: new Date('2026-08-20') }, now)).toBe(false);
    expect(isVisibleAnnouncement({ active: true, publishAt: new Date('2026-08-22') }, now)).toBe(false);
  });

  it('sorts pinned announcements first, then newest', () => {
    const items = [
      { pinned: false, publishAt: new Date('2026-08-21') },
      { pinned: true, publishAt: new Date('2026-08-19') },
      { pinned: false, publishAt: new Date('2026-08-22') },
    ];
    expect(sortAnnouncements(items).map((item) => item.publishAt.toISOString())).toEqual([
      '2026-08-19T00:00:00.000Z',
      '2026-08-22T00:00:00.000Z',
      '2026-08-21T00:00:00.000Z',
    ]);
  });
});
