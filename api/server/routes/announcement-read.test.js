const {
  addUnreadFlags,
  getReadAnnouncementIds,
  markAnnouncementsRead,
} = require('./announcement-read');

describe('announcement-read', () => {
  it('returns only announcement ids read by the requested user', async () => {
    const ReadModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ announcementId: 'a-1' }, { announcementId: 'a-2' }]),
      }),
    };

    await expect(getReadAnnouncementIds(ReadModel, 'user-1')).resolves.toEqual(
      new Set(['a-1', 'a-2']),
    );
    expect(ReadModel.find).toHaveBeenCalledWith({ userId: 'user-1' }, { announcementId: 1 });
  });

  it('upserts one read record per visible announcement and ignores invalid ids', async () => {
    const ReadModel = { bulkWrite: jest.fn().mockResolvedValue({}) };

    await markAnnouncementsRead(ReadModel, 'user-1', ['a-1', 'a-2'], new Set(['a-1']));

    expect(ReadModel.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { userId: 'user-1', announcementId: 'a-1' },
            update: { $set: { readAt: expect.any(Date) } },
            upsert: true,
          },
        },
      ],
      { ordered: false },
    );
  });

  it('does not write when no visible announcement was supplied', async () => {
    const ReadModel = { bulkWrite: jest.fn() };

    await markAnnouncementsRead(ReadModel, 'user-1', ['missing'], new Set());

    expect(ReadModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('treats concurrent duplicate-key upserts as an already-read announcement', async () => {
    const error = Object.assign(new Error('duplicate key'), {
      writeErrors: [{ code: 11000 }],
    });
    const ReadModel = { bulkWrite: jest.fn().mockRejectedValue(error) };

    await expect(
      markAnnouncementsRead(ReadModel, 'user-1', ['a-1'], new Set(['a-1'])),
    ).resolves.toBeUndefined();
  });

  it('marks only visible announcements without a read record as unread', () => {
    const items = [
      { _id: 'a-1', active: true, publishAt: new Date('2026-08-22') },
      { _id: 'a-2', active: true, publishAt: new Date('2026-08-22') },
      { _id: 'a-3', active: false, publishAt: new Date('2026-08-22') },
      { _id: 'a-4', active: true, publishAt: new Date('2026-08-23') },
    ];

    expect(addUnreadFlags(items, new Set(['a-1']), new Date('2026-08-22T12:00:00.000Z'))).toEqual([
      expect.objectContaining({ _id: 'a-1', unread: false }),
      expect.objectContaining({ _id: 'a-2', unread: true }),
      expect.objectContaining({ _id: 'a-3', unread: false }),
      expect.objectContaining({ _id: 'a-4', unread: false }),
    ]);
  });
});
