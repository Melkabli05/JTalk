import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar-art',
  templateUrl: './avatar-art.html',
  styleUrl: './avatar-art.scss',
})
export class AvatarArt {
  readonly avatarId = input.required<string>();
  readonly imageUrl = input<string | null>();
  readonly presetUrl = computed(() => /^preset-(?:[1-9]|10)$/.test(this.avatarId()) ? `/avatars/${this.avatarId()}.svg` : null);
  readonly variant = input<'full' | 'thumb'>('full');
}
