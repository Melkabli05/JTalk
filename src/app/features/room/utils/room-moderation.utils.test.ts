import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canModerateTargetUser,
  deriveSpeakerMuteState,
  orderListenersByRaisedHand,
  pruneHandRaiseQueue,
} from './room-moderation.utils.ts';

describe('pruneHandRaiseQueue', () => {
  it('removes departed users and seated speakers while preserving FIFO order', () => {
    const result = pruneHandRaiseQueue(
      ['u1', 'u2', 'u3', 'u4', 'u3'],
      new Set(['u2']),
      new Set(['u4']),
    );
    assert.deepEqual(result, ['u1', 'u3']);
  });

  it('returns the original array reference when nothing changes', () => {
    const queue = ['u1', 'u2'] as const;
    const result = pruneHandRaiseQueue(queue, new Set(['u9']), new Set(['host']));
    assert.equal(result, queue);
  });
});

describe('canModerateTargetUser', () => {
  const mods = new Set(['mod-1', 'mod-2']);

  it('allows host to moderate speakers, listeners, and moderators, but not self', () => {
    assert.equal(
      canModerateTargetUser({
        isHost: true,
        isModerator: false,
        currentUserId: 'host',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'mod-1',
      }),
      true,
    );
    assert.equal(
      canModerateTargetUser({
        isHost: true,
        isModerator: false,
        currentUserId: 'host',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'host',
      }),
      false,
    );
  });

  it('allows moderator to moderate regular users, but not host or other moderators', () => {
    assert.equal(
      canModerateTargetUser({
        isHost: false,
        isModerator: true,
        currentUserId: 'mod-1',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'guest-1',
      }),
      true,
    );
    assert.equal(
      canModerateTargetUser({
        isHost: false,
        isModerator: true,
        currentUserId: 'mod-1',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'host',
      }),
      false,
    );
    assert.equal(
      canModerateTargetUser({
        isHost: false,
        isModerator: true,
        currentUserId: 'mod-1',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'mod-2',
      }),
      false,
    );
  });

  it('forbids regular participants from moderating anyone', () => {
    assert.equal(
      canModerateTargetUser({
        isHost: false,
        isModerator: false,
        currentUserId: 'guest-1',
        hostId: 'host',
        moderatorIds: mods,
        targetUserId: 'guest-2',
      }),
      false,
    );
  });
});

describe('deriveSpeakerMuteState', () => {
  it('prioritizes host mute over self mute for both local and remote speakers', () => {
    assert.deepEqual(
      deriveSpeakerMuteState({
        userId: 'u-self',
        isYou: true,
        localMicOn: false,
        localMutedByHost: true,
        hostMutedIds: new Set(),
        remoteMutedIds: new Set(),
      }),
      { muted: true, muteReason: 'host' },
    );

    assert.deepEqual(
      deriveSpeakerMuteState({
        userId: 'u-remote',
        isYou: false,
        localMicOn: true,
        localMutedByHost: false,
        hostMutedIds: new Set(['u-remote']),
        remoteMutedIds: new Set(['u-remote']),
      }),
      { muted: true, muteReason: 'host' },
    );
  });

  it('distinguishes self-muted and unmuted speakers accurately', () => {
    assert.deepEqual(
      deriveSpeakerMuteState({
        userId: 'u-self',
        isYou: true,
        localMicOn: false,
        localMutedByHost: false,
        hostMutedIds: new Set(),
        remoteMutedIds: new Set(),
      }),
      { muted: true, muteReason: 'self' },
    );

    assert.deepEqual(
      deriveSpeakerMuteState({
        userId: 'u-remote',
        isYou: false,
        localMicOn: true,
        localMutedByHost: false,
        hostMutedIds: new Set(),
        remoteMutedIds: new Set(['u-remote']),
      }),
      { muted: true, muteReason: 'self' },
    );

    assert.deepEqual(
      deriveSpeakerMuteState({
        userId: 'u-remote',
        isYou: false,
        localMicOn: true,
        localMutedByHost: false,
        hostMutedIds: new Set(),
        remoteMutedIds: new Set(),
      }),
      { muted: false },
    );
  });
});

describe('orderListenersByRaisedHand', () => {
  it('places raised-hand listeners first in FIFO order and excludes seated speakers', () => {
    const ordered = orderListenersByRaisedHand(
      ['host', 'l1', 'l2', 'l3', 'l4'],
      ['l4', 'l2'],
      new Set(['host']),
    );
    assert.deepEqual(ordered, ['l4', 'l2', 'l1', 'l3']);
  });
});
