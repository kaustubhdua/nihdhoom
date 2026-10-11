import LatticeLoader from './LatticeLoader/LatticeLoader';

export function WorkspaceLoading() {
  return (
    <div className="workspace-skeleton" aria-label="Loading workspace">
      <div className="flex items-center justify-center py-3 text-emerald-800" role="status" aria-live="polite">
        <LatticeLoader label="Loading workspace" color="#166534" cellSize={7} gap={2} fontSize={13} step={80} />
      </div>
      <span className="sr-only">Loading workspace…</span>
      <div className="workspace-skeleton-hero">
        <div className="workspace-skeleton-copy">
          <span className="workspace-skeleton-line is-kicker" />
          <span className="workspace-skeleton-line is-title" />
          <span className="workspace-skeleton-line is-body" />
          <span className="workspace-skeleton-line is-body short" />
        </div>
        <span className="workspace-skeleton-image" />
      </div>
      <div className="workspace-skeleton-grid">
        <span /><span /><span />
      </div>
    </div>
  );
}
