export interface GraphCommit { id: string; description: string; createdAt: string; parentId: string | null; }
export interface GraphBranch { id: string; name: string; commits: GraphCommit[]; }

export interface CommitNode {
  id: string;
  shortId: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  branchId: string;
  branchName: string;
  col: number;
  row: number;
  parentId: string | null;
  branchFromId: string | null;
}

const PALETTE = ['#6ABFA8', '#AA7946', '#C49088', '#6E9EF0', '#B07AB0'];

export function buildBranchColors(branches: GraphBranch[]): Record<string, string> {
  const sorted = [...branches].sort((a, b) =>
    a.name === 'main' ? -1 : b.name === 'main' ? 1 : a.name.localeCompare(b.name)
  );
  const out: Record<string, string> = {};
  sorted.forEach((b, i) => { out[b.name] = PALETTE[i % PALETTE.length]; });
  return out;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

export function buildGraph(branches: GraphBranch[]): CommitNode[] {
  if (!branches.length) return [];

  const sorted = [...branches].sort((a, b) =>
    a.name === 'main' ? -1 : b.name === 'main' ? 1 : a.name.localeCompare(b.name)
  );

  const colByBranch: Record<string, number> = {};
  sorted.forEach((b, i) => { colByBranch[b.id] = i; });

  // Build a set of all commit IDs that belong to this branch, to detect cross-branch parent refs
  const commitBranch: Record<string, string> = {};
  sorted.forEach(branch => branch.commits.forEach(c => { commitBranch[c.id] = branch.id; }));

  const nodes: CommitNode[] = sorted.flatMap(branch =>
    branch.commits.map(c => {
      const parentOnSameBranch = c.parentId && commitBranch[c.parentId] === branch.id ? c.parentId : null;
      const branchFromId = c.parentId && commitBranch[c.parentId] !== branch.id ? c.parentId : null;
      return {
        id: c.id,
        shortId: c.id.slice(0, 7),
        description: c.description,
        createdAt: c.createdAt,
        relativeTime: relTime(c.createdAt),
        branchId: branch.id,
        branchName: branch.name,
        col: colByBranch[branch.id],
        row: 0,
        parentId: parentOnSameBranch,
        branchFromId,
      };
    })
  );

  // Sort by createdAt DESC so newest = row 0
  nodes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  nodes.forEach((n, i) => { n.row = i; });

  return nodes;
}
