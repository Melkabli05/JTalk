import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { languageLabelFor, languageNameFor } from '../../../../core/utils/language-codes';
import type { RoomSpeakerSummary, VoiceRoomDto } from '../../../../shared/models/voice-room.model';
import { avatarChipClassFor } from '../../../../shared/utils/avatar-chip.utils';
import { ROOM_CARD_AVATAR_LIMIT, ROOM_DOT_BY_LANG } from '../../constants/rooms.constants';

interface AvatarBadge {
  readonly userId: string;
  readonly displayName: string;
  readonly initial: string;
  readonly avatarUrl: string | null;
  readonly chipClass: string;
}

function toAvatarBadge(
  userId: string,
  profile: RoomSpeakerSummary | undefined,
  fallbackName: string,
): AvatarBadge {
  const displayName = profile?.displayName?.trim() || profile?.username?.trim() || fallbackName;
  return {
    userId,
    displayName,
    initial: (displayName[0] ?? 'J').toUpperCase(),
    avatarUrl: profile?.avatarUrl ?? null,
    chipClass: avatarChipClassFor(userId),
  };
}

@Component({
  selector: 'app-room-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './room-card.html',
  styleUrl: './room-card.scss',
})
export class RoomCard {
  readonly room = input.required<VoiceRoomDto>();
  readonly join = output<VoiceRoomDto>();
  readonly pin = output<VoiceRoomDto>();
  readonly notInterested = output<VoiceRoomDto>();

  readonly langKey = computed(() => {
    const code = (this.room().targetLanguage.split('-')[0] ?? '').toLowerCase();
    return code in ROOM_DOT_BY_LANG ? code : 'other';
  });
  readonly langLabel = computed(() => languageLabelFor(this.room().targetLanguage));
  readonly dotClass = computed(() => ROOM_DOT_BY_LANG[this.langKey()] ?? 'dot-brand-blue');
  readonly description = computed(() => {
    const r = this.room();
    return (
      r.topic ||
      `Practising ${languageNameFor(r.targetLanguage)} · ${languageNameFor(r.nativeLanguage)} speakers welcome`
    );
  });

  private readonly speakerProfileById = computed<ReadonlyMap<string, RoomSpeakerSummary>>(
    () => new Map((this.room().speakerProfiles ?? []).map((profile) => [profile.id, profile])),
  );

  readonly avatars = computed(() => {
    const r = this.room();
    const profiles = this.speakerProfileById();
    return r.speakers
      .filter((id) => id !== r.hostId)
      .slice(0, ROOM_CARD_AVATAR_LIMIT)
      .map((id) => toAvatarBadge(id, profiles.get(id), 'Speaker'));
  });

  readonly hostAvatar = computed(() => {
    const r = this.room();
    if (!r.hostId) return null;
    const hostProfile = r.host ?? this.speakerProfileById().get(r.hostId);
    return toAvatarBadge(r.hostId, hostProfile, 'Host');
  });

  readonly moreCount = computed(() => {
    const r = this.room();
    const hostOnStage = Boolean(r.hostId && r.speakers.includes(r.hostId));
    const overflow = Math.max(0, r.participantCount - (this.avatars().length + (hostOnStage ? 1 : 0)));
    return overflow > 0 ? `+${overflow}` : '';
  });

  readonly meta = computed(() => {
    const r = this.room();
    return `${r.speakers.length} speaking · ${r.participantCount} participant${r.participantCount === 1 ? '' : 's'} · ${r.maxStageSeats} seats`;
  });
}
