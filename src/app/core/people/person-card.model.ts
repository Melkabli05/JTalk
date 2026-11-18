import type { LanguageMatrix, PartnerMatch, SocialStats } from '@shared/utils/people';
import type { Person } from '../auth/identity.models';

export interface PersonDetails extends Person {
  readonly username: string;
  readonly bio: string;
  readonly countryCode: string;
  readonly joinedAt: string;
}

export interface PersonCard {
  readonly details: PersonDetails;
  readonly social: SocialStats | undefined;
  readonly languages: LanguageMatrix | undefined;
  readonly match: PartnerMatch | undefined;
  readonly isMe: boolean;
}
