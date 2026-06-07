import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export type SidebarTabDefinition = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

type SidebarTabsProps = {
  tabs: SidebarTabDefinition[];
  ariaLabel: string;
};

export const SidebarTabs = ({ tabs, ariaLabel }: SidebarTabsProps): JSX.Element => {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? '');
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;

  useEffect(() => {
    const firstTab = tabs[0];
    if (firstTab && !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(firstTab.id);
    }
  }, [activeTabId, tabs]);

  return (
    <div className="sidebar-tab-shell">
      {activeTab ? (
        <div
          className="sidebar-tab-panel"
          role="tabpanel"
          id={`sidebar-panel-${activeTab.id}`}
          aria-labelledby={`sidebar-tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      ) : null}

      <div className="sidebar-tab-list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            type="button"
            className={tab.id === activeTab?.id ? 'is-active' : ''}
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            aria-controls={`sidebar-panel-${tab.id}`}
            id={`sidebar-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
