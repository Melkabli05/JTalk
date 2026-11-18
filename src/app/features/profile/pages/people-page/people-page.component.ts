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
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { FollowButtonComponent } from '@shared/ui/follow-button/follow-button.component';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { msg } from '@shared/utils/i18n/msg';
import { PeopleDirectory } from '../../state/people-directory';
import { PeopleListComponent } from '../../ui/people-list/people-list.component';

/** What each list says when it is empty. The texts are marked with `msg` so they are translated. */
const EMPTY = {
  partners: {
    title: msg('No partners yet'),
    text: msg('Add the languages you speak and learn to your profile and partners show up here.'),
  },
  typing: {
    title: msg('Search for people'),
    text: msg('Type at least two letters of a name or a handle.'),
  },
  nobody: {
    title: msg('No one found'),
    text: msg('Try another spelling, or a part of their name or handle.'),
  },
  following: {
    title: msg('You are not following anyone yet'),
    text: msg('Follow people you enjoy talking to and they will be here.'),
  },
  followers: {
    title: msg('No followers yet'),
    text: msg('When someone follows you, you will see them here.'),
  },
  blocked: {
    title: msg('You have not blocked anyone'),
    text: msg('Someone you block from their profile or from a room will be listed here.'),
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
    TranslatePipe,
  ],
  providers: [PeopleDirectory],
  templateUrl: './people-page.component.html',
  styleUrl: './people-page.component.scss',
})
export default class PeoplePageComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly i18n = inject(I18n);

  protected readonly directory = inject(PeopleDirectory);
  protected readonly locale = this.i18n.locale;
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
        summary: this.i18n.t('{name} is unblocked.', { name: person.name }),
      }),
    );
  }
}
