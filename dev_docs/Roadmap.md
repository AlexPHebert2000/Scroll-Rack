# Roadmap

## MVP

### Database
- [X] Card schema
- [X] Bulk Card download (Scryfall bulk + arts)
- [X] Card lookup

### Deckbuilding
- [X] Deck schema
- [X] Create Deck
- [X] Get Deck
- [X] Change Deck Title
- [X] Change Deck Description
- [X] Add Card to Deck (working tree → quick commit)
- [X] Remove Card from Deck (working tree → quick commit)
- [X] Scryfall Search
- [X] Import deck from text (Moxfield format)
- [X] Delete Deck
- [X] Delete Branch
- [X] Art selection per card (per-decklist art preferences)
- [X] Auto-portrait from first card added

### Version Control
- [X] Branch, Commit, Change schemas
- [X] Add Branch (from any commit, O(delta) via snapshots)
- [X] Add Commit (manual, quick-commit, import)
- [X] Get Branch List
- [X] Get Branch (HEAD state)
- [X] Get Commit (historical snapshot replay)
- [X] Working tree / staging area with session conflict detection
- [X] Snapshot system (every 5th commit, O(delta) branching)
- [X] Commit graph visualization

### User Management
- [X] User schema
- [X] Create User (register)
- [X] Get User (`/me` + `/profile/:username`)
- [X] Login / Logout / Session management
- [ ] Change Password
- [ ] Change Username

### UI / Client
- [X] Login / Signup pages
- [X] Home page (deck list)
- [X] Deck view with card list grouped by type
- [X] Search drawer (Scryfall search + add to board)
- [X] Mana symbol display
- [X] DFC (double-faced card) face-flip
- [X] Card art selection menu
- [X] Commit graph
- [X] Branch switching
- [X] Historical commit navigation
- [X] AI-generated commit descriptions (Claude Haiku)
- [ ] Profile page (backend exists at `/profile/:username`, no client route yet)
- [ ] Change password / username UI

---

## Post-MVP

### Analytics
- [ ] Historical analytics — replay commit history to compute tag counts at arbitrary commits
  - Depends on: Snapshot write path ✅

### Social / Discovery
- [ ] Public deck profiles
- [ ] Deck sharing / fork
