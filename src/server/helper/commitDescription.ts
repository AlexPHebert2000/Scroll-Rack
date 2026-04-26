type Board = 'MAIN' | 'SIDE' | 'COMMANDER' | 'CONSIDERING';
type Action = 'ADD' | 'REMOVE';

const BOARD_LABELS: Record<Board, string> = {
  MAIN: 'main deck',
  SIDE: 'sideboard',
  COMMANDER: 'commander',
  CONSIDERING: 'considering',
};

export interface DescriptionChange {
  action: Action;
  board: Board;
  count: number;
  card: { name: string };
}

export function generateCommitDescription(changes: DescriptionChange[]): string {
  if (changes.length === 0) return 'Quick commit';

  const groups = new Map<string, { action: Action; board: Board; cards: string[] }>();

  for (const { action, board, count, card } of changes) {
    const key = `${action}:${board}`;
    if (!groups.has(key)) groups.set(key, { action, board, cards: [] });
    groups.get(key)!.cards.push(`${count}x ${card.name}`);
  }

  const parts: string[] = [];
  let isFirst = true;

  for (const { action, board, cards } of groups.values()) {
    const verb = isFirst
      ? (action === 'ADD' ? 'Added' : 'Removed')
      : (action === 'ADD' ? 'added' : 'removed');
    const label = BOARD_LABELS[board];

    let cardStr: string;
    if (cards.length === 1) {
      cardStr = cards[0];
    } else if (cards.length <= 3) {
      cardStr = cards.slice(0, -1).join(', ') + ' and ' + cards[cards.length - 1];
    } else {
      const total = changes
        .filter(c => c.action === action && c.board === board)
        .reduce((s, c) => s + c.count, 0);
      cardStr = `${total} cards`;
    }

    parts.push(`${verb} ${cardStr} to ${label}`);
    isFirst = false;
  }

  return parts.join(', ');
}
