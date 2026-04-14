# Server Test Coverage

Tests run with Jest in a Node environment using `supertest` against the Express app from `src/server/app.ts`. Prisma is mocked via `jest.mock('../db')` with `__esModule: true`.

---

## `user.test.ts`

### POST /api/user — registration
| Test | What it covers |
|---|---|
| Returns 201 on successful registration | Happy path — user created, 201 returned |
| Returns 409 when email is already taken | Duplicate email check fires before creation |
| Returns 409 when username is already taken | Duplicate username check fires before creation |

### POST /api/user/login
| Test | What it covers |
|---|---|
| Returns 200 and sets an httpOnly cookie on success | Session cookie named `scroll-rack-session` is set with `HttpOnly` flag |
| Returns 401 when the password is incorrect | bcrypt mismatch → rejected |
| Returns 401 when the user does not exist | Unknown email → rejected |

### GET /api/user/me
| Test | What it covers |
|---|---|
| Returns 200 with user data for a valid session | Session validated, user data returned, `expires` field not leaked to client |
| Returns 401 when no cookie is present | Missing cookie → rejected |
| Returns 401 when the session is expired | Past-date expiry field → rejected |
| Returns 401 when the session ID is not found | Unknown session ID (P2025) → rejected |

### GET /api/user/profile/:username
| Test | What it covers |
|---|---|
| Returns 200 with profile data | Username resolved, data returned |
| Returns 404 when user is not found | Unknown username returns 404 |
| Only sends one response when user is not found (regression) | Fixes a bug where 404 was followed by a 500, causing a double-response crash |

---

## `deck.test.ts`

### POST /api/deck — create deck
| Test | What it covers |
|---|---|
| Returns 201 on successful deck creation | Happy path — deck + branch + initial commit created |
| Returns 500 when creation fails | DB error handled gracefully |

### GET /api/deck/:id/:branch — fetch deck
| Test | What it covers |
|---|---|
| Returns 200 with deck data | Deck data returned successfully |
| Filters by branch id when branch param is provided | `where: { id: branch }` used when branch is in URL |
| Defaults to main branch when no branch param is provided | `where: { name: "main" }` used when branch omitted — client relies on this |
| Includes card faces in the query | `cards: { include: { faces: true } }` sent to Prisma — required for double-faced card rendering |
| Returns 404 when deck is not found | Prisma not-found error mapped to 404 |

### POST /api/deck/:id/:branch — commit changes
| Test | What it covers |
|---|---|
| Returns 201 on successful commit | Happy path — commit created, cards updated |
| Uses branch id (not deck id) in update (regression) | `branch.update` called with the branch id from the URL, not the deck id |
| Uses `set` (not `connect`) when updating cards | Full card list replaced on each commit — this is what makes removals take effect |
| Returns 404 when deck or branch is not found | P2025 Prisma error mapped to 404 |

---

## `scryfall.test.ts`

### GET /api/scryfall/search
| Test | What it covers |
|---|---|
| Returns matching cards from the local database | Scryfall results filtered against locally stored cards |
| URL-encodes the query string before forwarding to Scryfall (regression) | Special characters (`:`, `+`) are percent-encoded — prevents malformed Scryfall API requests |
| Returns 500 when the Scryfall API call fails | Network error handled gracefully |

---

## Recommended additions

The following tests are not yet written. See the [test write-up](../../client/tests/TESTS.md) for the full rationale; server-specific gaps are listed here.

### `deck.test.ts` — commit records history
The current `set` test verifies card membership is updated but does not assert that `commits: { create }` and `changes: { create: [...] }` are included in the `branch.update` call. A regression here would silently drop all commit history while the API still returns 201.

### `scryfall.test.ts` — missing `qString` param
What happens when `GET /api/scryfall/search` is called without a `qString`? The server currently forwards `undefined` to Scryfall. Desired behaviour (400 or graceful empty result) should be pinned with a test.

### `user.test.ts` — password is hashed before storing
Registration is tested for the happy-path 201 but there is no assertion that `bcrypt.hash` was called with the plaintext password. If that line were removed, passwords would be stored in plaintext and the existing test would still pass.

