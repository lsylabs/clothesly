# Frontend Architecture Overview

This document explains how the Clothesly frontend is organized, how data moves through the app, and where to add new features safely.

## Tech Stack

- Runtime: Expo + React Native + TypeScript
- Navigation: React Navigation (`native-stack` + `bottom-tabs`)
- Auth + data + storage: Supabase (`@supabase/supabase-js`)
- Local persistence/cache: AsyncStorage + in-memory maps (+ file cache for images)
- Testing: Vitest (utility-focused tests)

Frontend entrypoints:

- `index.js` registers the app root
- `src/App.tsx` wires providers (`SafeAreaProvider`, `AuthProvider`) and bootstraps navigation

## Frontend Scope in This Repo

- Frontend code lives in `src/`
- API/backend service code is in `backend/`
- Supabase SQL and docs are in `supabase/`

The frontend talks to:

- Supabase directly for most reads/writes and auth
- Backend endpoints (`EXPO_PUBLIC_BACKEND_URL`) for item create/finalize/delete orchestration

## Directory Layout (`src/`)

- `navigation/`: app/auth/root navigators and tab shell
- `screens/`: route-level UI by domain (`auth/`, `tabs/`, `add/`, `items/`, `closets/`)
- `components/`: reusable UI and feature components
- `services/`: data access, auth context, media uploads, cache services
- `features/`: feature-specific logic/constants (for example item metadata options)
- `types/`: DB types, domain types, navigation param types
- `utils/`: cross-cutting utilities (retry, validation)
- `config/`: env loading and guards

## Runtime Boot and Navigation

Navigation tree:

1. `RootNavigator`
2. If not authenticated: `AuthNavigator` (`SignIn`, `SignUp`)
3. If authenticated: `AppNavigator`
4. `AppNavigator` contains:
   - `AppTabs` (Home, Wardrobe, Add, Outfits, Profile)
   - modal/detail stack routes (`AddItem`, `AddCloset`, `ItemDetail`, `ClosetItems`)

`AppTabs` uses a central floating Add button that opens `AddActionSheet`, then routes to Add Item or Add Closet.

## Auth Architecture

`AuthProvider` (`services/AuthContext.tsx`) is the session source of truth.

- Reads initial session with `supabase.auth.getSession()`
- Subscribes to `onAuthStateChange()`
- Exposes `{ session, loading, hasEnv, signOut }`

`RootNavigator` blocks normal rendering when Supabase env vars are missing, and shows a dedicated setup message.

## Data Layer and Service Boundaries

The app uses service modules as the only place for network/storage side effects.

- `services/supabase.ts`: singleton Supabase client
  - Handles auth storage differences across native/web/fallback memory
- `services/itemService.ts`: item CRUD, item images, closet mappings, plus backend-assisted item endpoints
- `services/closetService.ts`: closet CRUD
- `services/itemMetadataOptionService.ts`: user-custom metadata options
- `services/mediaService.ts`: image picking, upload/delete, signed URL creation
- `services/storagePaths.ts`: deterministic storage paths for avatars/closets/items

Guideline: screens orchestrate flows; services execute I/O.

## Caching and Performance Strategy

There are three cache layers:

1. Wardrobe data cache (`wardrobeDataService`)
   - In-memory cache keyed by `userId`
   - Inflight dedupe to avoid duplicate concurrent loads
   - Used by Home/Wardrobe/Closet screens

2. Image URL/file cache (`imageCacheService`)
   - Caches signed URLs in memory + AsyncStorage index
   - Attempts local file download cache via Expo FileSystem
   - Sync helpers return immediate cached URLs to reduce UI flicker

3. Item detail cache (`itemDetailCacheService`)
   - Per-item snapshot in memory + AsyncStorage
   - Speeds up detail screen reopening

Retry behavior:

- `withRetry()` wraps transient network operations in key flows
- Retryable conditions include timeout/network-like failures

## Primary User Flows

### Sign in / sign up

- Email/password via Supabase auth
- Google OAuth via Expo AuthSession + WebBrowser
- Session updates propagate through `AuthProvider`

### Add closet

1. Create closet row in Supabase
2. Optionally upload cover image to storage
3. Update closet with stored image path
4. Refresh wardrobe cache

### Add item (two-phase backend flow)

1. Create item record via backend (`POST /v1/items`) to obtain `itemId`
2. Upload primary and extra images to Supabase storage using generated paths
3. Finalize item via backend (`POST /v1/items/{itemId}/finalize`) with image paths + closet mappings
4. Refresh wardrobe cache
5. On failure after creation, attempt rollback delete

This flow keeps DB writes coordinated and avoids orphaned partial state.

### View/edit item detail

- Loads item, extra images, closets, mappings, metadata options in parallel
- Supports category metadata updates
- Supports delete via backend endpoint (fallback to direct DB delete)

## Type System Strategy

- `types/database.ts`: generated/maintained Supabase table shapes
- `types/domain.ts`: frontend-friendly domain model shapes
- `services/mappers.ts`: DB row -> domain mapping helpers
- `types/navigation.ts`: route param contracts

This separation keeps UI decoupled from raw snake_case DB fields when needed.

## Environment Configuration

Defined in `src/config/env.ts`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_BACKEND_URL`

Current `.env.example` includes Supabase variables; add backend URL locally when testing backend-assisted item flows.

## Testing and Quality

Available scripts (root `package.json`):

- `npm run start`
- `npm run ios`
- `npm run android`
- `npm run web`
- `npm run test`
- `npm run typecheck`

Current automated tests focus on:

- validation rules (`utils/validation.test.ts`)
- retry behavior (`utils/retry.test.ts`)

## Onboarding: Where to Start

1. Read `src/App.tsx` and `navigation/` to understand app shell and route topology.
2. Read `services/AuthContext.tsx` and `services/supabase.ts` to understand auth/session lifecycle.
3. Read `screens/tabs/WardrobeScreen.tsx` as the main data-driven screen pattern.
4. Read `screens/add/AddItemScreen.tsx` for the most complex orchestration flow.
5. Add new side-effect logic in `services/` first, then consume it in screens/components.

## Common Extension Points

- New screen: add under `screens/`, define params in `types/navigation.ts`, register in navigator.
- New backend/Supabase operation: add to relevant `services/*Service.ts` module.
- New item metadata category/behavior: update `features/items/metadataOptions.ts` and metadata service usage.
- New cache policy: evolve `wardrobeDataService` / `imageCacheService` / `itemDetailCacheService` rather than adding ad-hoc screen state.
