# TODOS

## ~~Snapshot write path~~ DONE
Every commit endpoint (quick-commit, manual commit, import) now writes a SnapShot.
`POST /api/deck/:id/branch` finds the nearest snapshot at or before `sourceCommitId`,
loads its DeckCard state, and replays only the delta — O(delta) instead of O(all commits).

## ~~Delete routes~~ DONE
`DELETE /api/deck/:id` and `DELETE /api/deck/:id/:branch` are implemented in deck.ts.

## Historical analytics
Post-MVP: expose analytics for arbitrary historical commits, not just the current HEAD
snapshot. The current analytics endpoint reads from `Decklist.mainDeck` (current state).
Historical analytics would require replaying commit history from the nearest snapshot
up to the target commit, then computing tag counts on the replayed state.
Depends on: Snapshot write path being implemented.
