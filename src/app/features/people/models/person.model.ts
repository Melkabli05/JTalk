export interface PractisingPerson {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly initial: string;
  readonly chipClass: string;
  readonly languages: string;
  readonly avatarUrl?: string | null;
  readonly followedByMe: boolean;
}
