import Anthropic from '@anthropic-ai/sdk';
import { generateCommitDescription } from './commitDescription.js';
import type { DescriptionChange, DeckSnapshotCard } from './commitDescription.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!client) console.warn('[describeCommit] ANTHROPIC_API_KEY not set — AI descriptions disabled, using fallback');

function primaryType(typeLine?: string): string {
  if (!typeLine) return 'Other';
  const known = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle'];
  return known.find(t => typeLine.includes(t)) ?? 'Other';
}

function buildDeckSummary(snapshot: DeckSnapshotCard[]): string {
  const boards: Partial<Record<string, DeckSnapshotCard[]>> = {};
  for (const card of snapshot) {
    (boards[card.board] ??= []).push(card);
  }

  const boardOrder = ['MAIN', 'COMMANDER', 'SIDE', 'CONSIDERING'] as const;
  const boardLabel: Record<string, string> = {
    MAIN: 'Main deck', COMMANDER: 'Commander', SIDE: 'Sideboard', CONSIDERING: 'Considering',
  };

  const sections: string[] = [];
  for (const board of boardOrder) {
    const cards = boards[board];
    if (!cards?.length) continue;
    const total = cards.reduce((s, c) => s + c.count, 0);
    const byType = new Map<string, string[]>();
    for (const c of cards) {
      const t = primaryType(c.typeLine);
      (byType.get(t) ?? byType.set(t, []).get(t)!).push(`${c.count}x ${c.name}`);
    }
    const typeLines = [...byType.entries()]
      .map(([t, names]) => `  ${t}: ${names.join(', ')}`)
      .join('\n');
    sections.push(`${boardLabel[board]} (${total}):\n${typeLines}`);
  }

  return sections.join('\n');
}

export async function describeCommit(
  changes: DescriptionChange[],
  deckSnapshot?: DeckSnapshotCard[],
): Promise<string> {
  if (!client || changes.length === 0) {
    return generateCommitDescription(changes);
  }

  const boardLabel = (b: string) =>
    b === 'MAIN' ? 'main deck' : b === 'SIDE' ? 'sideboard' : b === 'COMMANDER' ? 'commander' : 'considering';

  const changeLines = changes.map(c => {
    const type = c.card.typeLine ? ` [${primaryType(c.card.typeLine)}]` : '';
    const mana = c.card.manaCost ? ` (${c.card.manaCost})` : '';
    return `${c.action} ${c.count}x ${c.card.name}${type}${mana} → ${boardLabel(c.board)}`;
  }).join('\n');

  const deckSection = deckSnapshot?.length
    ? `\nPost-change deck:\n${buildDeckSummary(deckSnapshot)}`
    : '';

  const prompt =
    `Write a short, natural commit message (one sentence, ≤10 words) for these Magic: The Gathering deck changes.\n` +
    `Focus on the strategic intent (e.g. "add mana base", "add removal package", "build synergy package") not just what cards moved.\n` +
    `Reply with only the commit message, no quotes or punctuation at the end.\n\n` +
    `Changes:\n${changeLines}${deckSection}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return text || generateCommitDescription(changes);
  } catch (e) {
    console.error('[describeCommit] AI call failed, using fallback:', e);
    return generateCommitDescription(changes);
  }
}
