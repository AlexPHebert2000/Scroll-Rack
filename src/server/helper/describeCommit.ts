import Anthropic from '@anthropic-ai/sdk';
import { generateCommitDescription } from './commitDescription.js';
import type { DescriptionChange } from './commitDescription.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function describeCommit(changes: DescriptionChange[]): Promise<string> {
  if (!client || changes.length === 0) {
    return generateCommitDescription(changes);
  }

  const lines = changes.map(c => {
    const boardLabel = c.board === 'MAIN' ? 'main deck'
      : c.board === 'SIDE' ? 'sideboard'
      : c.board === 'COMMANDER' ? 'commander'
      : 'considering';
    return `${c.action} ${c.count}x ${c.card.name} (${boardLabel})`;
  }).join('\n');

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Write a short, natural commit message (one sentence, ≤12 words) for these Magic: The Gathering deck changes:\n${lines}\n\nReply with only the commit message, no quotes or punctuation at the end.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return text || generateCommitDescription(changes);
  } catch {
    return generateCommitDescription(changes);
  }
}
