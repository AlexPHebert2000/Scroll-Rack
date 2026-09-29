# Client Test Coverage

Tests run with Jest in a jsdom environment using React Testing Library. Components are rendered in isolation; server calls are mocked via `jest.mock('axios')`.

---

## `Login.test.tsx`

| Test | What it covers |
|---|---|
| Renders email and password inputs | Basic render — both fields present |
| Password field is masked | `type="password"` attribute set — password not visible in plain text |
| Navigates to / after successful login | Success flow redirects to home |
| Does not navigate when login fails | Error response does not redirect |

---

## `Home.test.tsx`

| Test | What it covers |
|---|---|
| Renders deck names when session is valid | Deck list displayed from API response |
| No deck links when deck list is empty | Empty state handled — no broken links rendered |
| Redirects to /login when session query fails | 401 triggers navigation to login |
| Calls /api/user/me | Correct endpoint used to check session |

---

## `Decklist.test.tsx`

| Test | What it covers |
|---|---|
| Always fetches /api/deck/:id | Correct endpoint called — branch not appended client-side |
| Ignores branch URL param | Even when a branch param is present in the URL, the client still calls `/api/deck/:id` with no branch — the server defaults to main |

**Gaps** — see Recommended additions below.

---

## `CardImage.test.tsx`

| Test | What it covers |
|---|---|
| Renders the card image when imageUrl is present | `src` and `alt` attributes set correctly |
| Renders a text placeholder when imageUrl is null | Placeholder shown instead of broken `<img>` |
| Does not show the flip button for single-face cards | Button absent when `faces.length < 2` |
| Shows the flip button for double-faced cards | Button present when `faces.length >= 2` |
| Starts on the front face for double-faced cards | Front face image shown on initial render |
| Toggles to the back face when flip button is clicked | `src` changes to back face URL; button title updates |
| Toggles back to the front face on second click | Flip is reversible |
| Renders the action slot with card-overlay class | Action button wrapped in a container that carries the hover-visibility class |
| Flip button has card-overlay class | Flip button also fades in on hover — class present on the button element |

---

## `DecklistCards.test.tsx`

### List mode
| Test | What it covers |
|---|---|
| Renders all current card names | All cards in the deck are listed |
| Shows Undo button and strikethrough for pending removals | Removal staged state — card visually marked and Undo offered |
| onUndo called with correct id | Undo callback receives the right card id |
| onRemove called with correct id | Remove callback receives the right card id |
| Added cards show with + prefix | Pending adds visible with `+` indicator |

### Image mode
| Test | What it covers |
|---|---|
| Renders card images for current cards | Correct number of `<img>` elements rendered |
| Renders card images for added cards | Pending adds also appear in image mode |

---

## `SearchResults.test.tsx`

### List mode
| Test | What it covers |
|---|---|
| Shows Add button for a card not in the deck | Default state for a new card |
| Calls onAdd with the full card object | Callback receives the full `Card` object, not just the id — required for `queryClient.setQueryData` in Decklist |
| Shows Remove button for a card already in the deck | In-deck state shows Remove |
| Calls onRemove with card id | Remove callback receives the right id |
| Shows Undo button for a staged add | Pending add shows Undo instead of Add |
| Calls onUndo with card id for a staged add | Undo callback receives the right id |
| Shows "staged to add" secondary text | Label visible while add is pending |
| Shows "staged to remove" secondary text | Label visible while removal is pending |
| Shows "in deck" secondary text | Label shown for current deck cards with no pending change |
| Shows "No results found." when search returned nothing | Empty state message displayed |
| Does not show "No results found." when there is no active search | Message hidden before the first search is made |
| Renders multiple results | Multiple cards listed correctly |

### Image mode
| Test | What it covers |
|---|---|
| Renders card images for each result | Correct number of `<img>` elements rendered |
| Shows "No results found." in image mode | Empty state also works in image mode |

