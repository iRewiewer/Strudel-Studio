import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { MoveHorizontal, PanelRightClose, PanelRightOpen } from 'lucide-react';

export type SidebarTabDefinition = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

type SidebarTabsProps = {
  tabs: SidebarTabDefinition[];
  ariaLabel: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

type SidebarTabPlacement = 'left' | 'top' | 'right' | 'bottom';

const placementStorageKey = 'strudel-studio:inspector-tab-placement';
const tabPlacements: SidebarTabPlacement[] = ['left', 'top', 'right', 'bottom'];

const getNextPlacement = (placement: SidebarTabPlacement): SidebarTabPlacement => {
  const currentIndex = tabPlacements.indexOf(placement);
  return tabPlacements[(currentIndex + 1) % tabPlacements.length] ?? 'left';
};

const loadStoredPlacement = (): SidebarTabPlacement => {
  try {
    const storedPlacement = window.localStorage.getItem(placementStorageKey);
    return tabPlacements.includes(storedPlacement as SidebarTabPlacement)
      ? (storedPlacement as SidebarTabPlacement)
      : 'left';
  } catch {
    return 'left';
  }
};

export const SidebarTabs = ({
  tabs,
  ariaLabel,
  collapsed = false,
  onToggleCollapsed,
}: SidebarTabsProps): JSX.Element => {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? '');
  const [placement, setPlacement] = useState<SidebarTabPlacement>(() => loadStoredPlacement());
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const nextPlacement = getNextPlacement(placement);

  useEffect(() => {
    const firstTab = tabs[0];
    if (firstTab && !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(firstTab.id);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(placementStorageKey, placement);
    } catch {
      // Placement is purely cosmetic, so failing to persist it is harmless.
    }
  }, [placement]);

  if (collapsed) {
    return (
      <div className="sidebar-tab-shell is-collapsed">
        <button
          type="button"
          className="sidebar-tab-collapse-button"
          onClick={onToggleCollapsed}
          aria-label="Expand inspector sidebar"
          title="Expand inspector sidebar"
        >
          <PanelRightOpen size={17} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-tab-shell" data-placement={placement}>
      {activeTab ? (
        <div
          className="sidebar-tab-panel"
          data-tab-id={activeTab.id}
          role="tabpanel"
          id={`sidebar-panel-${activeTab.id}`}
          aria-labelledby={`sidebar-tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      ) : null}

      <div className="sidebar-tab-rail">
        <div className="sidebar-tab-list" role="tablist" aria-label={ariaLabel}>
          {tabs.map((tab) => (
            <button
              type="button"
              className={tab.id === activeTab?.id ? 'is-active' : ''}
              role="tab"
              aria-selected={tab.id === activeTab?.id}
              aria-controls={`sidebar-panel-${tab.id}`}
              aria-label={tab.label}
              id={`sidebar-tab-${tab.id}`}
              key={tab.id}
              title={tab.label}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="sidebar-tab-placement-button"
          onClick={() => setPlacement(nextPlacement)}
          aria-label={`Move inspector tabs to ${nextPlacement}`}
          title={`Move tabs to ${nextPlacement}`}
        >
          <MoveHorizontal size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="sidebar-tab-collapse-button"
          onClick={onToggleCollapsed}
          aria-label="Collapse inspector sidebar"
          title="Collapse inspector sidebar"
        >
          <PanelRightClose size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
