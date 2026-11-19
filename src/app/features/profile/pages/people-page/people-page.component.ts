import { Component, effect, inject, signal, untracked } from '@angular/core';
import type { PersonSummary } from '@shared/utils/people';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { IconField } from '@openng/optimus-ui/iconfield';
import { InputIcon } from '@openng/optimus-ui/inputicon';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Message } from '@openng/optimus-ui/message';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@openng/optimus-ui/tabs';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { PeopleDirectory } from '../../state/people-directory';
import { PeopleListComponent } from '../../ui/people-list/people-list.component';

/** What each list says when it is empty. The texts are marked with `msg` so they are translated. */
const EMPTY = {
  partners: {
    title: 'No partners yet',
    text: 'Add the languages you speak and learn to your profile and partners show up here.',
  },
  typing: {
    title: 'Search for people',
    text: 'Type at least two letters of a name or a handle.',
  },
  nobody: {
    title: 'No one found',
    text: 'Try another spelling, or a part of their name or handle.',
  },
  following: {
    title: 'You are not following anyone yet',
    text: 'Follow people you enjoy talking to and they will be here.',
  },
  followers: {
    title: 'No followers yet',
    text: 'When someone follows you, you will see them here.',
  },
  blocked: {
    title: 'You have not blocked anyone',
    text: 'Someone you block from their profile or from a room will be listed here.',
  },
} as const;

type Section = 'discover' | 'search' | 'following' | 'followers' | 'blocked';

@Component({
  selector: 'app-people-page',
  imports: [
    ButtonDirective,
    FollowButtonComponent,
    IconField,
    InputIcon,
    InputText,
    Message,
    PeopleListComponent,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
  ],
  providers: [PeopleDirectory],
  templateUrl: './people-page.component.html',
  styleUrl: './people-page.component.scss',
})
export default class PeoplePageComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly directory = inject(PeopleDirectory);
  protected readonly empty = EMPTY;

  protected readonly section = signal<Section>('discover');

  constructor() {
    // Each list is read the first time it is looked at, not all of them up front.
    effect(() => {
      const section = this.section();
      untracked(() => {
        switch (section) {
          case 'discover':
            this.directory.partners.load();
            break;
          case 'following':
            this.directory.following.load();
            break;
          case 'followers':
            this.directory.followers.load();
            break;
          case 'blocked':
            this.directory.blocked.load();
            break;
          case 'search':
            break;
        }
      });
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/people', id]);
  }

  protected typed(event: Event): void {
    this.directory.term.set((event.target as HTMLInputElement).value);
  }

  protected unblock(person: PersonSummary): void {
    this.directory.unblock(person.id, () =>
      this.toast.add({
        severity: 'success',
        summary: `${person.name} is unblocked.`,
      }),
    );
  }
}
