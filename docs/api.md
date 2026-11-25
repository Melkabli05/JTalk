# JTalk HTTP and realtime contracts

Source snapshot from the controllers, Java records and validation annotations. Path placeholders bind UUIDs except the avatar version (long) and language code (string). The method signatures below name query defaults, body types and response types. Caller parameters annotated with `@CurrentUser` are injected from the validated JWT. Clients never send them. JSON property names match record components. UUID and Instant serialize as strings. Lists are JSON arrays, maps are objects and enums use their exact names.

All application endpoints require the shared Auth0 API access token except the public versioned avatar GET. The webhook accepts the original signed body (application/webhook+json or application/json) and its LiveKit Authorization header. The backend health-management endpoints are separate from the controller inventory. For webhooks, event-by-event fields and authorization rules see the [integration guide](integration.md).

Profile batches accept 1–500 UUIDs. Search accepts up to 50 results. Page size is 1–100 for paginated collections. Profile handles match `^[a-z0-9_.]{3,30}$`; language codes match `^[a-z]{2,3}(-[A-Z]{2})?$` and countries match `^[A-Z]{2}$`. The profile request limit is 20 learning languages. A raw JPEG or PNG upload must fit the configured avatar size limit (default 204800 bytes). Its response is the updated profile. The public avatar URL returns the current bytes, even if its version is stale, with a shorter cache lifetime for a stale version.

Room lists use Micronaut's CursoredPage envelope with a content array. To fetch the next page pass the last room's createdAt and id together as afterCreatedAt and afterId. The user matchmaking endpoint has its own explicit next cursor fields. Stage size defaults to 8 and is bounded from 2 to 12. A comment allows up to 500 characters in each text field. CORRECTION requires correctedContent and TEXT disallows it. A pinned chat topic allows 200 characters. Temporal fields in events are server times.

Service error identifiers below map to a lower-case, hyphenated suffix on `urn:jtalk:user:problem:` or `urn:jtalk:live-communication:problem:`. HTTP failures use status, type, title and detail. Authentication and validation can fail before the service method executes. Rate-limit responses can include Retry-After.

## jtalk-user-service

Source revision `9cec42ec31730075f547003f7982ad845e20650a`.

### AvatarController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `PUT /api/v1/users/me/avatar` | `@CurrentUser UUID userId, @Header("Content-Type") String contentType, @Body byte[] image` | `UserProfileResponse`  |
| `GET /api/v1/users/{userId}/avatar/{version}` | `UUID userId, long version` | `image bytes with stored content type`  |

### SocialGraphController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /api/v1/users/{userId}/follow` | `UUID userId, @CurrentUser UUID callerId` | `empty` NO_CONTENT |
| `DELETE /api/v1/users/{userId}/follow` | `UUID userId, @CurrentUser UUID callerId` | `empty` NO_CONTENT |
| `GET /api/v1/users/{userId}/followers` | `UUID userId, @QueryValue(defaultValue = "0") @Min(0) int page, @QueryValue(defaultValue = "20") @Min(1) @Max(UserConstants.MAX_PAGE_SIZE) int size` | `FollowListResponse`  |
| `GET /api/v1/users/{userId}/following` | `UUID userId, @QueryValue(defaultValue = "0") @Min(0) int page, @QueryValue(defaultValue = "20") @Min(1) @Max(UserConstants.MAX_PAGE_SIZE) int size` | `FollowListResponse`  |
| `GET /api/v1/users/{userId}/social` | `UUID userId, @CurrentUser UUID callerId` | `SocialStatsResponse`  |
| `POST /api/v1/users/{userId}/block` | `UUID userId, @CurrentUser UUID callerId` | `empty` NO_CONTENT |
| `DELETE /api/v1/users/{userId}/block` | `UUID userId, @CurrentUser UUID callerId` | `empty` NO_CONTENT |
| `GET /api/v1/users/me/blocks` | `@CurrentUser UUID callerId` | `List<UserSummaryResponse>`  |

### UserProfileController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /api/v1/users/me` | `@CurrentUser UUID userId, @Body @Valid CreateProfileRequest request` | `UserProfileResponse` CREATED |
| `GET /api/v1/users/me` | `@CurrentUser UUID userId` | `UserProfileResponse`  |
| `PATCH /api/v1/users/me` | `@CurrentUser UUID userId, @Body @Valid UpdateProfileRequest request` | `UserProfileResponse`  |
| `DELETE /api/v1/users/me` | `@CurrentUser UUID userId` | `empty` NO_CONTENT |
| `GET /api/v1/users/{userId}` | `UUID userId` | `UserProfileResponse`  |
| `POST /api/v1/users/batch` | `@Body @Valid BatchProfilesRequest request` | `List<UserSummaryResponse>`  |
| `GET /api/v1/users/search` | `@CurrentUser UUID userId, @QueryValue @NotBlank @Size(max = 50) String q, @QueryValue(defaultValue = "20") @Min(1) @Max(UserConstants.MAX_SEARCH_RESULTS) int size` | `List<UserSummaryResponse>`  |
| `GET /api/v1/users/matchmaking` | `@CurrentUser UUID userId, @Nullable @QueryValue @Pattern(regexp = UserConstants.LANGUAGE_PATTERN) String nativeLang, @Nullable @QueryValue @Pattern(regexp = UserConstants.LANGUAGE_PATTERN) String learningLang, @QueryValue(defaultValue = "20") @Min(1) @Max(UserConstants.MAX_PAGE_SIZE) int size, @Nullable @QueryValue Instant afterCreatedAt, @Nullable @QueryValue UUID afterId` | `UserPageResponse`  |
| `GET /api/v1/users/me/languages` | `@CurrentUser UUID userId` | `LanguageMatrixResponse`  |
| `GET /api/v1/users/{userId}/languages` | `UUID userId` | `LanguageMatrixResponse`  |
| `POST /api/v1/users/me/languages` | `@CurrentUser UUID userId, @Body @Valid AddLanguageRequest request` | `LanguageMatrixResponse`  |
| `DELETE /api/v1/users/me/languages/{languageCode}` | `@CurrentUser UUID userId, String languageCode` | `LanguageMatrixResponse`  |

### JSON fields and validation

- `GraphDirection` — `FOLLOWING, FOLLOWERS`
- `LanguageType` — `NATIVE, LEARNING`
- `ProficiencyLevel` — `BEGINNER, INTERMEDIATE, ADVANCED, FLUENT`
- `UserStatus` — `ACTIVE, SUSPENDED`
- `FollowEdge` — `UUID userId, Instant createdAt`
- `AddLanguageRequest` — `@NotBlank @Pattern(regexp = UserConstants.LANGUAGE_PATTERN, message = "must be a language tag such as ar or pt-BR") String languageCode, @NotNull LanguageType languageType, @Nullable ProficiencyLevel proficiencyLevel`
- `BatchProfilesRequest` — `@NotEmpty @Size(max = UserConstants.MAX_BATCH_IDS) List<@NotNull UUID> ids`
- `CreateProfileRequest` — `@NotBlank @Pattern(regexp = UserConstants.USERNAME_PATTERN, message = "must be 3-30 lowercase letters, digits, '_' or '.'") String username, @NotBlank @Size(max = 50) @Pattern(regexp = UserConstants.NOT_BLANK_PATTERN, message = "must not be blank") String displayName, @Nullable @Size(max = 300) String bio, @Nullable @Size(max = 500) @Pattern(regexp = UserConstants.AVATAR_PATTERN, message = "must be an https URL or an app path such as /avatars/a.svg") String avatarUrl, @Nullable @Pattern(regexp = UserConstants.COUNTRY_PATTERN, message = "must be an ISO 3166-1 alpha-2 code such as MA") String countryCode, @NotBlank @Pattern(regexp = UserConstants.LANGUAGE_PATTERN, message = "must be a language tag such as ar or pt-BR") String nativeLanguage, @Nullable @Size(max = UserConstants.MAX_LANGUAGES_PER_REQUEST) List<@NotNull @Valid LearningLanguageRequest> learningLanguages`
- `LearningLanguageRequest` — `@NotBlank @Pattern(regexp = UserConstants.LANGUAGE_PATTERN, message = "must be a language tag such as ar or pt-BR") String languageCode, @Nullable ProficiencyLevel proficiencyLevel`
- `UpdateProfileRequest` — `@Nullable @Size(min = 1, max = 50) @Pattern(regexp = UserConstants.NOT_BLANK_PATTERN, message = "must not be blank") String displayName, @Nullable @Size(max = 300) String bio, @Nullable @Size(max = 500) @Pattern(regexp = UserConstants.AVATAR_PATTERN, message = "must be an https URL or an app path such as /avatars/a.svg") String avatarUrl, @Nullable @Pattern(regexp = UserConstants.COUNTRY_PATTERN, message = "must be an ISO 3166-1 alpha-2 code such as MA") String countryCode, @Nullable @Pattern(regexp = UserConstants.LANGUAGE_PATTERN, message = "must be a language tag such as ar or pt-BR") String nativeLanguage, @Nullable @Size(max = UserConstants.MAX_LANGUAGES_PER_REQUEST) List<@NotNull @Valid LearningLanguageRequest> learningLanguages, @Nullable @Pattern(regexp = UserConstants.USERNAME_PATTERN, message = "must be 3-30 lowercase letters, digits, '_' or '.'") String username`
- `AvatarResponse` — `String contentType, byte[] image, long version`
- `FollowListResponse` — `List<UserSummaryResponse> content, int page, int size, long total`
- `LanguageEntryResponse` — `String languageCode, ProficiencyLevel proficiencyLevel`
- `LanguageMatrixResponse` — `UUID userId, List<String> nativeLanguages, List<LanguageEntryResponse> learningLanguages`
- `SocialStatsResponse` — `long followerCount, long followingCount, boolean followedByMe, boolean followsMe`
- `UserPageResponse` — `List<UserSummaryResponse> content, boolean hasNext, Instant nextAfterCreatedAt, UUID nextAfterId`
- `UserProfileResponse` — `UUID id, String username, String displayName, String bio, String avatarUrl, String countryCode, String nativeLanguage, @JsonInclude(JsonInclude.Include.ALWAYS) List<String> nativeLanguages, @JsonInclude(JsonInclude.Include.ALWAYS) List<LanguageEntryResponse> learningLanguages, Instant createdAt`
- `UserSummaryResponse` — `UUID id, String username, String displayName, String avatarUrl, String countryCode, String nativeLanguage`

### Service errors

- `USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found")`
- `PROFILE_ALREADY_EXISTS(HttpStatus.CONFLICT, "Profile already exists")`
- `USERNAME_TAKEN(HttpStatus.CONFLICT, "Username is taken")`
- `USERNAME_CHANGE_TOO_SOON(HttpStatus.UNPROCESSABLE_ENTITY, "Username changed too recently")`
- `AVATAR_INVALID(HttpStatus.UNPROCESSABLE_ENTITY, "Picture not accepted")`
- `CANNOT_FOLLOW_SELF(HttpStatus.UNPROCESSABLE_ENTITY, "You cannot follow yourself")`
- `CANNOT_BLOCK_SELF(HttpStatus.UNPROCESSABLE_ENTITY, "You cannot block yourself")`
- `FOLLOW_NOT_ALLOWED(HttpStatus.FORBIDDEN, "You cannot follow this user")`
- `FOLLOW_LIMIT_REACHED(HttpStatus.UNPROCESSABLE_ENTITY, "Following limit reached")`
- `LANGUAGE_CONFLICT(HttpStatus.CONFLICT, "Language is already listed another way")`
- `LANGUAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "Language not listed")`
- `PRIMARY_LANGUAGE_REQUIRED(HttpStatus.UNPROCESSABLE_ENTITY, "Your primary native language cannot be removed")`
- `TOO_MANY_LANGUAGES(HttpStatus.UNPROCESSABLE_ENTITY, "Too many languages")`
- `NO_LEARNING_LANGUAGE(HttpStatus.UNPROCESSABLE_ENTITY, "No learning language to match on")`

## live-communication-service

Source revision `f30059e815588896e1b91a78cc6552f95ac92e94`.

### CommentController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `GET /api/v1/voice-rooms/{roomId}/comments` | `UUID roomId, @CurrentUser UUID userId` | `ChatState`  |
| `POST /api/v1/voice-rooms/{roomId}/comments` | `UUID roomId, @CurrentUser UUID userId, @Body @Valid PostCommentRequest request` | `RoomComment` CREATED |
| `PUT /api/v1/voice-rooms/{roomId}/comments/{commentId}/reaction` | `UUID roomId, UUID commentId, @CurrentUser UUID userId, @Body @Valid ReactionRequest request` | `empty` NO_CONTENT |
| `DELETE /api/v1/voice-rooms/{roomId}/comments/{commentId}/reaction` | `UUID roomId, UUID commentId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `DELETE /api/v1/voice-rooms/{roomId}/comments/{commentId}` | `UUID roomId, UUID commentId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/comments/mute/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `DELETE /api/v1/voice-rooms/{roomId}/comments/mute/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `PUT /api/v1/voice-rooms/{roomId}/comments/topic` | `UUID roomId, @CurrentUser UUID userId, @Body @Valid PinTopicRequest request` | `empty` NO_CONTENT |
| `DELETE /api/v1/voice-rooms/{roomId}/comments/topic` | `UUID roomId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `PUT /api/v1/voice-rooms/{roomId}/comments/{commentId}/pin` | `UUID roomId, UUID commentId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `DELETE /api/v1/voice-rooms/{roomId}/comments/{commentId}/pin` | `UUID roomId, UUID commentId, @CurrentUser UUID userId` | `empty` NO_CONTENT |

### LiveKitWebhookController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /webhooks/livekit` | `@Body String body, @Nullable @Header(HttpHeaders.AUTHORIZATION) String authorization` | `empty`  |

### ParticipantController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /api/v1/voice-rooms/{roomId}/participants/join` | `UUID roomId, @CurrentUser UUID userId` | `RoomSessionResponse`  |
| `POST /api/v1/voice-rooms/{roomId}/participants/leave` | `UUID roomId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `GET /api/v1/voice-rooms/{roomId}/participants` | `UUID roomId` | `List<ParticipantResponse>`  |
| `DELETE /api/v1/voice-rooms/{roomId}/participants/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |

### ReactionController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /api/v1/voice-rooms/{roomId}/reactions` | `UUID roomId, @CurrentUser UUID userId, @Body @Valid ReactionRequest request` | `empty` ACCEPTED |

### RoomFeedController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `GET /api/v1/voice-rooms/feed` | `—` | `text/event-stream (RoomFeedEvent or ping)`  |

### StageController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `GET /api/v1/voice-rooms/{roomId}/stage` | `UUID roomId` | `StageResponse`  |
| `POST /api/v1/voice-rooms/{roomId}/stage/join` | `UUID roomId, @CurrentUser UUID userId` | `RoomSessionResponse`  |
| `POST /api/v1/voice-rooms/{roomId}/stage/leave` | `UUID roomId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/stage/raise-hand` | `UUID roomId, @CurrentUser UUID userId` | `empty` ACCEPTED |
| `DELETE /api/v1/voice-rooms/{roomId}/stage/raise-hand` | `UUID roomId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/stage/promote/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/stage/mute/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/stage/demote/{targetUserId}` | `UUID roomId, UUID targetUserId, @CurrentUser UUID userId` | `empty` NO_CONTENT |
| `POST /api/v1/voice-rooms/{roomId}/stage/network-mode` | `UUID roomId, @CurrentUser UUID userId, @Body @Valid NetworkModeRequest request` | `empty` NO_CONTENT |

### VoiceRoomController

| HTTP request | Controller parameters | Success response |
| --- | --- | --- |
| `POST /api/v1/voice-rooms` | `@CurrentUser UUID userId, @Body @Valid CreateVoiceRoomRequest request` | `RoomSessionResponse` CREATED |
| `GET /api/v1/voice-rooms` | `@Nullable @QueryValue @Size(max = 10) String targetLanguage, @QueryValue(defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size, @Nullable @QueryValue Instant afterCreatedAt, @Nullable @QueryValue UUID afterId` | `CursoredPage<VoiceRoomResponse>`  |
| `GET /api/v1/voice-rooms/{roomId}` | `UUID roomId` | `VoiceRoomResponse`  |
| `PATCH /api/v1/voice-rooms/{roomId}` | `UUID roomId, @CurrentUser UUID userId, @Body @Valid UpdateVoiceRoomRequest request` | `VoiceRoomResponse`  |
| `DELETE /api/v1/voice-rooms/{roomId}` | `UUID roomId, @CurrentUser UUID userId` | `empty` NO_CONTENT |

### JSON fields and validation

- `ChatEventType` — `COMMENT_POSTED, COMMENT_DELETED, COMMENT_REACTED, COMMENT_PINNED, COMMENT_UNPINNED, CHAT_MUTED, CHAT_UNMUTED, TOPIC_CHANGED`
- `CommentType` — `TEXT, CORRECTION`
- `NetworkMode` — `OPTIMAL, LOW_BANDWIDTH`
- `ParticipantRole` — `HOST, SPEAKER, LISTENER`
- `PresenceStatus` — `ACTIVE, RECONNECTING`
- `Reaction` — `HEART, CLAP, THUMBS_UP, SMILE, SPARKLES, FIRE, PARTY, LAUGH, WOW, THANKS`
- `RoomEventType` — `STAGE_UPDATED, HAND_RAISED, HAND_LOWERED, SPEAKER_RECONNECTING, SPEAKER_RECONNECTED, PRESENCE_CHANGED, ROOM_UPDATED, REACTIONS, PARTICIPANT_PROFILE_UPDATED, COMMENT_PINNED, COMMENT_UNPINNED`
- `RoomFeedEventType` — `SNAPSHOT, ROOM_OPENED, ROOM_UPDATED, ROOM_CLOSED, ROOM_STATS`
- `VoiceRoomStatus` — `ACTIVE, CLOSED`
- `ChatEvent` — `ChatEventType type, UUID roomId, Instant timestamp, @Nullable RoomComment comment, @Nullable UUID commentId, @Nullable UUID targetUserId, @Nullable String topic, @Nullable Reaction reaction, @Nullable Reaction previous`
- `ChatState` — `List<RoomComment> comments, @Nullable String topic, boolean muted, List<UUID> mutedUsers, List<CommentReactions> reactions`
- `CommentReactions` — `UUID commentId, Map<Reaction, Integer> counts, @Nullable Reaction mine`
- `Participant` — `UUID userId, ParticipantRole role, PresenceStatus status`
- `ParticipantProfileUpdate` — `UUID userId, String avatarUrl`
- `PresenceChange` — `long participantCount, List<UUID> joined, List<UUID> left`
- `ReactionBurst` — `UUID userId, Reaction reaction`
- `RoomComment` — `UUID id, UUID authorId, CommentType type, String content, @Nullable String correctedContent, @Nullable UUID replyTo, Instant createdAt, @Nullable Instant pinnedAt`
- `RoomLiveStats` — `List<UUID> speakers, long participantCount, long handRaiseCount`
- `RoomRealtimeEvent` — `RoomEventType type, UUID roomId, @Nullable UUID targetUserId, Instant timestamp, @Nullable StageState stage, @Nullable PresenceChange presence, @Nullable List<ReactionBurst> reactions, @Nullable RoomSettings settings, @Nullable ParticipantProfileUpdate profileUpdate, @Nullable String commentId`
- `RoomSettings` — `String title, @Nullable String topic, int maxStageSeats, UUID hostId`
- `StageState` — `List<UUID> speakers, List<UUID> handRaiseQueue`
- `UserEvent` — `@Nullable String type, @Nullable UUID userId, @Nullable String avatar`
- `CreateVoiceRoomRequest` — `@NotBlank @Size(max = 80) String title, @Nullable @Size(max = 255) String topic, @NotBlank @Size(max = 10) String targetLanguage, @NotBlank @Size(max = 10) String nativeLanguage, @Nullable @Min(CommunicationConstants.MIN_STAGE_SEATS) @Max(CommunicationConstants.MAX_STAGE_SEATS) Integer maxStageSeats`
- `NetworkModeRequest` — `@NotNull NetworkMode mode, @Nullable @Size(max = 20) List<@NotBlank @Size(max = 64) String> secondaryTrackSidsToDrop, @Nullable @Size(max = 20) List<@NotBlank @Size(max = 64) String> primaryTrackSidsToKeep`
- `PinTopicRequest` — `@NotBlank @Size(max = 200) String text`
- `PostCommentRequest` — `@NotNull CommentType type, @NotBlank @Size(max = 500) String content, @Nullable @Size(max = 500) String correctedContent, @Nullable UUID replyTo`
- `ReactionRequest` — `@NotNull Reaction reaction`
- `UpdateVoiceRoomRequest` — `@Nullable @Pattern(regexp = ".*\\S.*", message = "must not be blank") @Size(max = 80) String title, @Nullable @Size(max = 255) String topic, @Nullable @Min(CommunicationConstants.MIN_STAGE_SEATS) @Max(CommunicationConstants.MAX_STAGE_SEATS) Integer maxStageSeats`
- `ParticipantResponse` — `UUID userId, ParticipantRole role, PresenceStatus status`
- `RoomFeedEvent` — `RoomFeedEventType type, @Nullable UUID roomId, @Nullable VoiceRoomResponse room, @Nullable List<VoiceRoomResponse> rooms, @Nullable RoomLiveStats live`
- `RoomSessionResponse` — `VoiceRoomResponse room, String liveKitUrl, String liveKitToken, ParticipantRole role, boolean canPublishAudio`
- `StageResponse` — `List<UUID> speakers, List<UUID> handRaiseQueue`
- `VoiceRoomResponse` — `UUID id, String title, String topic, UUID hostId, String targetLanguage, String nativeLanguage, int maxStageSeats, VoiceRoomStatus status, Instant createdAt, List<UUID> speakers, long participantCount, long handRaiseCount`

### Service errors

- `VOICE_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "Voice room not found")`
- `NOT_ROOM_HOST(HttpStatus.FORBIDDEN, "Only the host can do this")`
- `STAGE_FULL(HttpStatus.CONFLICT, "Stage is full")`
- `ALREADY_ON_STAGE(HttpStatus.CONFLICT, "Already on stage")`
- `HOST_CANNOT_LEAVE_STAGE(HttpStatus.UNPROCESSABLE_ENTITY, "The host keeps their stage seat")`
- `CANNOT_KICK_HOST(HttpStatus.UNPROCESSABLE_ENTITY, "The host cannot be kicked")`
- `KICKED_FROM_ROOM(HttpStatus.FORBIDDEN, "Removed from this room")`
- `NOT_IN_ROOM(HttpStatus.FORBIDDEN, "Join the room first")`
- `REACTING_TOO_FAST(HttpStatus.TOO_MANY_REQUESTS, "Reacting too fast")`
- `INVALID_COMMENT(HttpStatus.BAD_REQUEST, "Not a comment the room can take")`
- `CHAT_MUTED(HttpStatus.FORBIDDEN, "Muted in the chat")`
- `COMMENTING_TOO_FAST(HttpStatus.TOO_MANY_REQUESTS, "Commenting too fast")`
- `COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "Comment not found")`
- `CANNOT_MUTE_HOST(HttpStatus.UNPROCESSABLE_ENTITY, "The host cannot be muted in their own chat")`
- `INVALID_WEBHOOK_SIGNATURE(HttpStatus.UNAUTHORIZED, "Invalid webhook signature")`
- `MEDIA_SERVER_ERROR(HttpStatus.BAD_GATEWAY, "Media server rejected the request")`
- `MEDIA_SERVER_UNREACHABLE(HttpStatus.BAD_GATEWAY, "Media server unreachable")`

