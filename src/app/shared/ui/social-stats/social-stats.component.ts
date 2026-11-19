import { Component, computed, input } from '@angular/core';
import { Tag } from '@openng/optimus-ui/tag';
import { compactCount } from '@shared/utils/people';

@Component({
  selector: 'app-social-stats',
  imports: [Tag],
  template: `
    <ul class="stats">
      <li>
        <strong>{{ followersText() }}</strong>
        <span>Followers</span>
      </li>
      <li>
        <strong>{{ followingText() }}</strong>
        <span>Following</span>
      </li>
    </ul>
    @if (followsMe()) {
      <p-tag severity="secondary" [rounded]="true" value="Follows you" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }

    .stats {
      display: flex;
      gap: 1.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: baseline;
      gap: 0.375rem;
      font-variant-numeric: tabular-nums;
    }

    strong {
      font-size: var(--p-jtalk-type-card);
      font-weight: 700;
    }

    span {
      color: var(--p-text-muted-color);
      font-size: var(--p-jtalk-type-secondary);
    }
  `,
})
export class SocialStatsComponent {
  readonly followers = input.required<number>();
  readonly following = input.required<number>();
  readonly followsMe = input(false);

  protected readonly followersText = computed(() => compactCount(this.followers()));
  protected readonly followingText = computed(() => compactCount(this.following()));
}
