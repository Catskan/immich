import { AlbumUserRole, AssetMediaResponseDto, AssetVisibility, LoginResponseDto } from '@immich/sdk';
import { createUserDto } from 'src/fixtures';
import { app, utils } from 'src/utils';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const buckets = {
  jan: '2024-01-01',
  feb: '2024-02-01',
  mar: '2024-03-01',
  apr: '2024-04-01',
};
const dates = {
  janOwned: '2024-01-15T12:00:00Z',
  febShared: '2024-02-10T12:00:00Z',
  marShared: '2024-03-10T12:00:00Z',
  aprShared: '2024-04-10T12:00:00Z',
};

let counter = 0;

const createAssetAt = async (accessToken: string, isoDate: string): Promise<AssetMediaResponseDto> => {
  counter += 1;
  return utils.createAsset(accessToken, {
    deviceAssetId: `timeline-scope-${counter}`,
    fileCreatedAt: isoDate,
    fileModifiedAt: isoDate,
    visibility: AssetVisibility.Timeline,
  });
};

const setShowInTimeline = async (accessToken: string, albumId: string, userId: string, showInTimeline: boolean) => {
  const { status } = await request(app)
    .put(`/albums/${albumId}/user/${userId}/preferences`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ showInTimeline });

  expect(status).toBe(204);
};

const shareAlbumWithAsset = async (options: {
  owner: LoginResponseDto;
  recipient: LoginResponseDto;
  albumName: string;
  assetDate: string;
  showInTimeline?: boolean;
}) => {
  const asset = await createAssetAt(options.owner.accessToken, options.assetDate);
  const album = await utils.createAlbum(options.owner.accessToken, {
    albumName: options.albumName,
    assetIds: [asset.id],
    albumUsers: [{ userId: options.recipient.userId, role: AlbumUserRole.Viewer }],
  });

  if (options.showInTimeline !== undefined) {
    await setShowInTimeline(options.recipient.accessToken, album.id, options.recipient.userId, options.showInTimeline);
  }

  return { asset, album };
};

const getBuckets = (accessToken: string, query: Record<string, unknown>) =>
  request(app).get('/timeline/buckets').query(query).set('Authorization', `Bearer ${accessToken}`);

describe('timeline scoped by album', () => {
  let admin: LoginResponseDto;
  let user1: LoginResponseDto;
  let user2: LoginResponseDto;

  beforeAll(async () => {
    await utils.resetDatabase();
    admin = await utils.adminSetup();
    [user1, user2] = await Promise.all([
      utils.userSetup(admin.accessToken, createUserDto.user1),
      utils.userSetup(admin.accessToken, createUserDto.user2),
    ]);
  });

  it('defaults showInTimeline to false for a new album user', async () => {
    const { album } = await shareAlbumWithAsset({
      owner: user2,
      recipient: user1,
      albumName: 'scope-default',
      assetDate: dates.janOwned,
    });

    const { status, body } = await request(app)
      .get(`/albums/${album.id}`)
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect(status).toBe(200);
    expect(body.albumUsers).toEqual(expect.arrayContaining([expect.objectContaining({ showInTimeline: false })]));
  });

  it('includes shared album assets when withSharedAlbums is on', async () => {
    await shareAlbumWithAsset({
      owner: user2,
      recipient: user1,
      albumName: 'scope-on',
      assetDate: dates.febShared,
      showInTimeline: true,
    });

    const { status, body } = await getBuckets(user1.accessToken, {
      withSharedAlbums: true,
      visibility: AssetVisibility.Timeline,
    });

    expect(status).toBe(200);
    expect(body).toEqual(expect.arrayContaining([expect.objectContaining({ timeBucket: buckets.feb })]));
  });

  it('excludes them when the flag is omitted', async () => {
    const { status, body } = await getBuckets(user1.accessToken, {
      visibility: AssetVisibility.Timeline,
    });

    expect(status).toBe(200);
    expect(body).not.toEqual(expect.arrayContaining([expect.objectContaining({ timeBucket: buckets.feb })]));
  });

  it('excludes them when the recipient turned the preference off', async () => {
    await shareAlbumWithAsset({
      owner: user2,
      recipient: user1,
      albumName: 'scope-off',
      assetDate: dates.marShared,
      showInTimeline: false,
    });

    const { status, body } = await getBuckets(user1.accessToken, {
      withSharedAlbums: true,
      visibility: AssetVisibility.Timeline,
    });

    expect(status).toBe(200);
    expect(body).not.toEqual(expect.arrayContaining([expect.objectContaining({ timeBucket: buckets.mar })]));
  });

  it('never leaks an album a third party opted into', async () => {
    // user2 shares with user1 only. Nothing of it may reach the admin timeline.
    await shareAlbumWithAsset({
      owner: user2,
      recipient: user1,
      albumName: 'scope-third-party',
      assetDate: dates.aprShared,
      showInTimeline: true,
    });

    const { status, body } = await getBuckets(admin.accessToken, {
      withSharedAlbums: true,
      visibility: AssetVisibility.Timeline,
    });

    expect(status).toBe(200);
    expect(body).not.toEqual(expect.arrayContaining([expect.objectContaining({ timeBucket: buckets.apr })]));
  });

  it('flags shared assets with isShared in the bucket payload', async () => {
    const { status, body } = await request(app)
      .get('/timeline/bucket')
      .query({
        withSharedAlbums: true,
        visibility: AssetVisibility.Timeline,
        timeBucket: buckets.feb,
      })
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect(status).toBe(200);
    expect(body.isShared).toEqual(expect.arrayContaining([true]));
  });

  it('rejects withSharedAlbums together with an album filter', async () => {
    const { album } = await shareAlbumWithAsset({
      owner: user2,
      recipient: user1,
      albumName: 'scope-conflict',
      assetDate: dates.janOwned,
      showInTimeline: true,
    });

    const { status } = await getBuckets(user1.accessToken, {
      withSharedAlbums: true,
      albumId: album.id,
    });

    expect(status).toBe(400);
  });

  it('rejects withSharedAlbums on the archive', async () => {
    const { status } = await getBuckets(user1.accessToken, {
      withSharedAlbums: true,
      visibility: AssetVisibility.Archive,
    });

    expect(status).toBe(400);
  });
});
