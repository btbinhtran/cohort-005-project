# Knock's integration surface for an in-app feed

Research for [#2](https://github.com/btbinhtran/cohort-005-project/issues/2), part of map [#1](https://github.com/btbinhtran/cohort-005-project/issues/1).
Researched 2026-11-13.

**Versions checked:** `@knocklabs/node` 1.41.1 (published 2026-11-10), `@knocklabs/react` 0.15.1, `@knocklabs/react-core` 0.17.1, `@knocklabs/client` 0.23.1 (all published 2026-11-06). I read the SDK claims straight from the published npm tarballs (`npm pack`) and cite them as `pkg@version:path`. All other claims come from docs.knock.app or knock.app as they read on the research date.

> Repo note: `package.json` pins `react-router` **8.3.0**, but the map says "React Router v7". Nothing below depends on the router version. `@knocklabs/react` only needs React 17, 18 or 19 as a peer, and Cadence uses React 19.2.

## TL;DR

- **Identity:** a Knock user is any string `id` (max 256 chars, no `/` or `#`, can't be changed later). Use the Cadence user primary key. Users are created by an explicit `users.update` (upsert) or inline in a trigger's `recipients`/`actor`.
- **Browser auth:** the browser uses the **public API key** plus, when *enhanced security mode* is on, a **user token**. The token is an RS256 JWT that the server signs with `signUserToken(userId)` from `@knocklabs/node`. Enhanced security is set per environment. It's off by default, and Knock recommends it for production. With it off, anyone holding the public key can act as any user.
- **Trigger:** `knock.workflows.trigger(key, { recipients, actor, data, tenant, cancellation_key })` returns `workflow_run_id`, and *all workflow runs execute asynchronously*. Expect one HTTP round trip (≈ sync from the action's point of view), not delivery.
- **Failure:** the SDK retries connection errors, 408, 409, 429 and 5xx **twice by default** and times out after **60s**. It sends an auto-generated `Idempotency-Key` that stays the same across its own retries. Knock caches 2xx responses per key for 24h. Pass your own key if *our* code might retry.
- **React:** `@knocklabs/react` has drop-in `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed` and `NotificationCell`, styled by CSS variables or a `renderItem` override. It also exports the headless hooks (`useKnockFeed`, `useNotifications`, `useNotificationStore`, `usePreferences`). Real-time updates come over a websocket to Knock.
- **Statuses:** seen, read, interacted and archived are independent flags. The popover calls `markAllAsSeen()` on open, and clicking a cell calls `markAsInteracted()`, which also sets `read_at`. The badge counts *unseen* by default.
- **Preferences:** opt-out model. A `PreferenceSet` holds `workflows`, `categories`, `channel_types` and `channels` booleans (plus conditions), and anything unset means opted in. **No prebuilt React preference UI exists.** Use the `usePreferences` hook or the API, or Knock's hosted preference page (default set only).
- **Free tier:** 10,000 messages a month, and in-app messages count. Environments are unlimited, feed retention is unlimited and logs are kept 30 days. Per-tenant preferences and i18n are paid features.
- **Local dev:** no public URL is needed. Every connection is outbound: server to `api.knock.app`, and browser to Knock over HTTP and a websocket. Tests should fake our own notifier boundary. Knock has no official mock, and in-app channels have no channel-level sandbox.

---

## 1. Identifying users and authenticating the browser

### Users

- Only `id` is required. It's "An identifier for this user from your system, should be unique." The id can be at most 256 characters, can't contain `/` or `#`, and "you cannot change a user's id once it has been set". Knock recommends a stable primary key. Optional fields are `name`, `email`, `avatar`, `phone_number` and `timezone`, plus arbitrary `properties`, which are deep-merged on each upsert. A property can't be removed, only set to `null`. ([Users](https://docs.knock.app/concepts/users))
- "User data must be synchronized to Knock to send the user a notification or to reference that user in a notification." ([Users](https://docs.knock.app/concepts/users))
- There are two ways to identify:
  - **Explicit upsert:** `client.users.update(userID, body)` (`@knocklabs/node@1.41.1:resources/users/users.d.ts`).
  - **Inline on trigger:** `recipients` (and `actor`, `tenant`) can be full objects. Inline recipients "will be guaranteed to be identified **before** the workflow is triggered". ([Trigger API](https://docs.knock.app/send-notifications/triggering-workflows/api), `workflows.d.ts`: "This endpoint also handles inline identifications for the `actor`, `recipient`, and `tenant` fields.")
- **Gotcha: the browser identifies users by default.** If `KnockProvider` gets a `user` object, `@knocklabs/client` defaults to `identificationStrategy: "inline"`. It then fires `this.user.identify(...)` from the browser on every authenticate, and swallows any error. Pass `identificationStrategy="skip"` if the server should own user data (`@knocklabs/client@0.23.1:dist/esm/knock.mjs`, `authenticate()`).

### Browser auth (public key + user token)

- Browser clients authenticate with the **public API key**, plus an optional **user token**: "Without enhanced security mode, a request with your public key can act as any user." With enhanced security mode on, Knock "requires clients to send both the public API key and a signed user token". It's set per environment, and Knock recommends turning it on in production while leaving it off in development. ([Security & authentication](https://docs.knock.app/in-app-ui/security-and-authentication))
- The React feed docs say the same thing: "By default, Knock feeds are accessible to anyone who has the feed ID." ([React feed](https://docs.knock.app/in-app-ui/react/feed))
- **Signing the token:**
  - The token is an RS256 JWT. `sub` (the user id) is required, `iat` and `exp` are recommended, and optional grants can scope access to objects and tenants.
  - The private signing key comes from Dashboard > Platform > API keys, is shown once, and is conventionally stored as `KNOCK_SIGNING_KEY`. If you see "secretOrPrivateKey must be an asymmetric key", use the base64 form of the key.
  - Knock recommends matching the token lifetime to the session lifetime. ([Security & authentication](https://docs.knock.app/in-app-ui/security-and-authentication))
- **SDK details:**
  - `import { signUserToken } from "@knocklabs/node"` has the signature `signUserToken(userId, { signingKey?, expiresInSeconds? }): Promise<string>`. It defaults to `process.env.KNOCK_SIGNING_KEY`, signs with `jose` RS256, and expires after 3600s by default (`@knocklabs/node@1.41.1:lib/tokenSigner.{d.ts,js}`).
  - Older docs show the import path `@knocklabs/node/lib/tokenSigner`. In 1.x it's re-exported from the package root.
- **Token refresh:** `KnockProvider` accepts `userToken`, `onUserTokenExpiring(currentToken, decoded) => Promise<string|void>` and `timeBeforeExpirationInMs` (`@knocklabs/react-core@0.17.1:KnockProvider.d.ts`).
- **What this means for Cadence:** the root loader signs a token for the session user and passes `{ publicKey, feedChannelId, userId, userToken }` to the client.
- **DevUI user switching:**
  - When `authenticate()` sees a changed `userId` or `userToken`, it tears down the feed instances and the socket and reinitializes them (`knock.mjs`, `authenticate()`). Re-rendering `KnockProvider` with the new user and token after a DevUI switch therefore re-subscribes cleanly, with no remount needed.
  - `KnockProvider` also has an `enabled` prop that keeps the client idle until identity is ready.

## 2. Workflows and triggering from Node (`@knocklabs/node`)

- **Setup:** workflows are authored in the Knock dashboard (or with the CLI). They are made of steps, including channel steps such as the in-app feed channel. "By default, Knock will create a single in-app channel for you." ([Feeds overview](https://docs.knock.app/in-app-ui/feeds/overview))
- **Status:** triggering an *Inactive* workflow returns a `workflow_inactive` error and creates no runs. ([Triggering workflows](https://docs.knock.app/send-notifications/triggering-workflows))
- **Environments and commits:** content is versioned by commits and promoted from development to production. ([Environments](https://docs.knock.app/concepts/environments))
- **Client:**
  - `new Knock()` reads `KNOCK_API_KEY` (the secret key), and also `KNOCK_BASE_URL` (default `https://api.knock.app`), `KNOCK_BRANCH` and `KNOCK_LOG`.
  - **The constructor throws `KnockError` if the API key is missing**, so instantiate it lazily or behind our own interface (`@knocklabs/node@1.41.1:client.js`).
- **Call:** `client.workflows.trigger(key, params, options?)` (`resources/workflows.d.ts`). The params are:
  - `recipients`: user ids, inline user objects, or object references. Up to 1,000 per call, with no bulk trigger. Use `$trigger_data` for per-recipient data.
  - `actor`: who caused the run. It's linked on feed messages, and the actor is excluded when it's a subscriber of an object recipient.
  - `data`: JSON, up to 10MB. Strings over 1024 bytes are truncated in the logs.
  - `tenant`: scopes feed messages.
  - `cancellation_key`: enables `workflows.cancel` later.
  - `settings.sandbox_mode` and `settings.skip_delay`.

  ([Trigger API](https://docs.knock.app/send-notifications/triggering-workflows/api))
- **Async:** "Returns an identifier for the workflow run request. **All workflow runs are executed asynchronously.**" The response is `{ workflow_run_id }` (`workflows.d.ts`). A successful trigger means Knock accepted the run, not that a feed message exists yet.
- **Idempotency:**
  - The `Idempotency-Key` header is honoured **only** on `POST /workflows/:key/trigger`. Keys are up to 255 chars and kept for 24h. A repeat key with the same params returns the cached response with `idempotent-replayed: true`. A repeat key with different params returns an error. Only 2xx responses are cached, so a retry after a 4xx or 5xx runs again. ([Idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests))
  - The Node SDK **auto-generates** `stainless-node-retry-<uuid>` for every non-GET request and reuses it across its own retries. You can override it per request with `{ idempotencyKey }` (`client.js`, `buildHeaders` / `defaultIdempotencyKey`).
  - For dedupe across *our* retries, or duplicate form submits, derive a key from the domain event, for example `refund-request-approved:<id>`.
- **Retries and timeouts:** the SDK retries connection errors, 408, 409, 429 and 5xx **2 times by default**, with backoff. Change this with `maxRetries`. Requests time out after 1 minute by default, set by `timeout` in ms, and throw `APIConnectionTimeoutError`. The error classes are `BadRequestError` (400), `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404), `UnprocessableEntityError` (422), `RateLimitError` (429), `InternalServerError` (5xx) and `APIConnectionError`, all subclasses of `Knock.APIError`. ([knock-node README](https://github.com/knocklabs/knock-node))
- **Rate limits:** limits are tiered per endpoint (1, 5, 60, 200 or 1,000 req/s), and an over-limit request gets `429 Too Many Requests`. ([Rate limits](https://docs.knock.app/api-reference/overview/rate-limits))
- **What this means for Cadence's failure behaviour:** Knock has no outbox and no guaranteed delivery. If the trigger call fails after the SDK's retries, the error reaches our action. Whether the domain write still commits is our decision. The default worst case is 3 attempts × 60s, so set a short `timeout` and `maxRetries` if triggering inline in a request.
- **Trigger frequency:** by default a workflow triggers every time. It can be set to "once per recipient", optionally per tenant. Preference opt-outs are applied automatically. ([Triggering workflows](https://docs.knock.app/send-notifications/triggering-workflows))

## 3. In-app feed: components, hooks, state, real time

- **Setup** ([React feed](https://docs.knock.app/in-app-ui/react/feed)):

  ```tsx
  import "@knocklabs/react/dist/index.css";
  <KnockProvider apiKey={publicKey} user={{ id }} userToken={token} identificationStrategy="skip">
    <KnockFeedProvider feedId={feedChannelId}>
      <NotificationIconButton ref={btnRef} onClick={() => setVisible(!visible)} />
      <NotificationFeedPopover buttonRef={btnRef} isVisible={visible} onClose={() => setVisible(false)} />
    </KnockFeedProvider>
  </KnockProvider>
  ```

  `feedId` is the in-app channel id from Dashboard > Channels and sources.
- **Components** (`@knocklabs/react@0.15.1:dist/types/index.d.ts`): `NotificationIconButton`, `UnseenBadge`, `NotificationFeedPopover`, `NotificationFeed`, `NotificationFeedContainer`, `NotificationFeedHeader`, `NotificationCell`, `MarkAsRead`, `EmptyFeed` and `Avatar`.
- **Headless hooks:** re-exported from `@knocklabs/react-core`: `useKnockClient`, `useKnockFeed` (gives `{ feedClient, useFeedStore }`), `useNotifications`, `useNotificationStore`, `useFeedSettings`, `usePreferences`, `useTranslations` and `useKnockAuthState`.
- **Client-only:** the ESM bundle starts with `"use client"`. Treat it as client-only (no SSR of feed contents). The docs page gives no SSR guidance.
- **Customisation** ([React feed](https://docs.knock.app/in-app-ui/react/feed)):
  - `renderItem` replaces a cell, and `badgeCountType="unread"` switches the badge count.
  - `colorMode` takes `light` or `dark`.
  - Theme with `--rnf-*` CSS variables, or drop Knock's CSS and style the `rnf-` classes yourself.
  - Use `onNotificationClick` and `onNotificationButtonClick` to handle clicks. The template's Action URL becomes a default redirect.
  - `initialFilterStatus` filters the feed.
  - Only `en` strings ship. Pass others via `i18n`.
- **Engagement statuses:**
  - Seen, read, interacted and archived are independent, and a message can have several at once. "Seen" means the message was fetched for display, not that it was read. ([Knock in-app integration](https://docs.knock.app/integrations/in-app/knock), [Message statuses](https://docs.knock.app/send-notifications/message-statuses))
  - Feed metadata returns unread, read and seen counts for badges. ([Feeds overview](https://docs.knock.app/in-app-ui/feeds/overview))
- **What the components do by default** (from source):
  - `NotificationFeedPopover` calls `feedClient.markAllAsSeen()` on open when `unseen_count > 0` (`NotificationFeedPopover.mjs`).
  - Clicking a `NotificationCell` (or one of its buttons) calls `markAsInteracted`, which optimistically sets **both** `read_at` and `interacted_at` (`NotificationCell.mjs`; `@knocklabs/client@0.23.1:clients/feed/feed.mjs`).
  - The cell's "x" calls `markAsArchived`, and the header button calls `markAllAsRead`.
  - The docs show overriding `onOpen` to mark items read instead. ([React feed](https://docs.knock.app/in-app-ui/react/feed))
- **Feed client API:** `markAsSeen/Unseen`, `markAsRead/Unread`, `markAsInteracted`, `markAsArchived/Unarchived`, `markAllAsSeen`, `markAllAsRead`, `markAllAsArchived` and `markAllReadAsArchived` (`clients/feed/feed.d.ts`).
- **Filter options** (`FeedClientOptions`): `status` (`unread|read|unseen|seen|all`), `archived` (`include|exclude|only`), `tenant`, `has_tenant`, `workflow_categories`, flat `trigger_data`, `page_size`, `mode` (`compact` by default, which strips nested data and arrays).
- **Real time:** clients receive new messages over a websocket from Knock's managed real-time service. ([Feeds overview](https://docs.knock.app/in-app-ui/feeds/overview)) Related options:
  - `auto_manage_socket_connection` disconnects the socket in inactive tabs.
  - `__experimentalCrossBrowserUpdates` syncs state across tabs. ([React feed](https://docs.knock.app/in-app-ui/react/feed))
- **Immutability:** message content "can't be changed once Knock generates it". To fix a message, archive it and re-trigger. ([Feeds overview](https://docs.knock.app/in-app-ui/feeds/overview))

## 4. Preferences

- **Model:** each recipient has a `PreferenceSet`, normally `default`, with `workflows`, `categories`, `channel_types` and `channels` keys (plus `commercial_subscribed`). Each key holds booleans or conditions.
  - **Opt-out semantics:** "If you do not set a preference … Knock defaults them to `true`". Knock "only sends a notification if all preference combinations that exist on the recipient evaluate to `true`."
  - A specific channel beats its channel type. A category set to `false` blocks the message even when a channel is explicitly `true`.
  - An environment-level default preference set can replace "everyone opted in". Tenant preferences layer on top of it, which is a paid feature.

  ([Preferences overview](https://docs.knock.app/preferences/overview))
- **Categories** are tags on workflows, so per-category opt-outs map naturally onto Cadence groupings such as "refunds" or "enrollments".
- **UI options:**
  - **Hosted preference center:** Knock renders the page at a signed URL. It's configured in the dashboard and supports only the `default` set.
  - **Custom:** "You build the UI and embed it in your product, using Knock's preferences API." ([Preferences overview](https://docs.knock.app/preferences/overview))
  - `@knocklabs/react` 0.15.1 exports **no preference component**, only the `usePreferences()` hook, which returns `{ preferences, setPreferences, getAllPreferences, isLoading }` (`@knocklabs/react-core@0.17.1`).
  - Server side: `users.getPreferences`, `setPreferences`, `listPreferences` and `unsetPreferences` (`@knocklabs/node@1.41.1:resources/users/users.d.ts`).
- **With in-app as the only channel**, per-channel-type preferences are meaningless. The useful levels are per-workflow and per-category.

## 5. Free tier, environments, local dev, testing

- **Free plan:**
  - Limits: 10,000 messages a month, unlimited environments, team members and stored profiles, unlimited feed retention, 30-day log retention, and a 99.9% SLA.
  - A message is "A single message delivered to a single user on a single channel", and **in-app messages count**. Preference-blocked messages aren't billed.
  - Excluded: per-tenant branding and preferences, translations (i18n), branding removal, audit logs and SSO.

  ([Pricing](https://knock.app/pricing), as of 2026-11-13)
- **Environments** (version-sensitive, as of 2026-11-13; older accounts got Development and Production from the start):
  - "Every account starts with only production. Enabling environments adds development."
  - Development starts nearly empty: only the default email layout is copied, and workflows stay in production.
  - Each environment has its own API keys. Users, messages and logs "will never be shared between environments".
  - Channel provider credentials aren't copied, though the in-app channel needs none.
  - Content is edited where it was created, then committed and promoted upward.

  ([Environments](https://docs.knock.app/concepts/environments))
- **No public URL is needed:** in-app needs no inbound webhooks. The server calls `api.knock.app`, and the browser connects to Knock directly (HTTP plus websocket). Knock only needs a public URL from us if we opt into outbound webhooks, which this scope doesn't use.
- **Testing without hitting Knock:**
  - Knock ships **no official mock or fake** of the Node SDK, and the testing docs don't cover unit-testing app code. ([Testing workflows](https://docs.knock.app/send-notifications/testing-workflows))
  - Options:
    1. Put our own `Notifier` interface at the service boundary, with a fake in Vitest. This is the recommended option.
    2. `vi.mock("@knocklabs/node")`.
    3. Point `KNOCK_BASE_URL` at a local stub server (`client.js`).
  - Remember the constructor throws when `KNOCK_API_KEY` is unset, so tests mustn't construct the real client.
- **Testing against Knock:**
  - The dashboard test runner uses the last *saved* (not committed) workflow version and ignores trigger frequency.
  - `settings.sandbox_mode` generates messages without delivering them, and `settings.skip_delay` skips delays.
  - The Knock CLI (`knock workflow run`) can drive runs from CI. ([Testing workflows](https://docs.knock.app/send-notifications/testing-workflows))
  - The **channel-level** sandbox mode setting is available "for all channel types except in-app" (per the docs search snippet for the sandbox-mode page). Isolate in-app test data with the development environment instead.

## Open implications for the map

1. **Trigger semantics:** one blocking HTTP call per trigger. The SDK retries and dedupes on its own (auto idempotency key), but by default it can block for up to about 3 minutes. Decide on timeout and retry values, and whether a trigger failure rolls back the domain write. Passing a domain-derived `idempotencyKey` makes app-level retries safe for 24h.
2. **Identification:** inline identify on trigger is enough to *create* recipients. The `KnockProvider` default (browser-side inline identify) should be turned off with `identificationStrategy="skip"` if the server owns names and roles. The root loader must sign a token per DevUI user. Re-rendering the provider with a new user and token re-subscribes.
3. **Enhanced security:** off in the development environment by default. Decide whether local dev signs tokens anyway, which needs `KNOCK_SIGNING_KEY` locally and gives parity with prod.
4. **Seed and Knock setup:** workflows live in Knock, not in the repo, unless we adopt the Knock CLI to pull and push them as files. The dev environment starts empty.
5. **Preferences UI:** it must be built by us with `usePreferences`, or delegated to the hosted page. Per-tenant preferences are not on the free plan.
