# TODOS

## Snapshot write path
Implement snapshot creation in the commit flow. Every Nth commit (suggested: every 10th)
should write a SnapShot record pointing to the current Decklist state. Then update
`POST /api/deck/:id/branch` to: (1) find the most recent SnapShot at or before the
target commit, (2) use that snapshot's Decklist as the starting state, (3) replay only
the changes between that snapshot and the target commit (≤N-1 instead of all commits).
The SnapShot model and Decklist relation already exist in schema — the write path is
the missing piece.

## Delete routes
Add `DELETE /api/deck/:id` and `DELETE /api/deck/:id/:branch`.
- Deck delete: cascade deletes all branches, commits, changes, and decklists
- Branch delete: prevent deleting the last branch on a deck (require at least one)
- Require auth middleware (the deck must belong to the session user)
Add tests for both routes including auth guard and cascade behavior.

## Historical analytics
Post-MVP: expose analytics for arbitrary historical commits, not just the current HEAD
snapshot. The current analytics endpoint reads from `Decklist.mainDeck` (current state).
Historical analytics would require replaying commit history from the nearest snapshot
up to the target commit, then computing tag counts on the replayed state.
Depends on: Snapshot write path being implemented.
