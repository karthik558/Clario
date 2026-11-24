export type TableDensity = 'comfortable' | 'compact';
export type DocumentsDefaultView = 'grid' | 'table';
export type SearchModePreference = 'hybrid' | 'bm25' | 'vector';

export interface WorkspacePreferences {
  sidebar_collapsed_default: boolean;
  show_quick_ask: boolean;
  show_footer_shortcuts: boolean;
  table_density: TableDensity;
  default_documents_view: DocumentsDefaultView;
  default_search_mode: SearchModePreference;
  ask_streaming_default: boolean;
  ask_research_mode_default: boolean;
  show_citations_default: boolean;
  show_followups: boolean;
  auto_open_task_drawer: boolean;
  ai_critique_default: boolean;
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  sidebar_collapsed_default: false,
  show_quick_ask: true,
  show_footer_shortcuts: true,
  table_density: 'comfortable',
  default_documents_view: 'grid',
  default_search_mode: 'hybrid',
  ask_streaming_default: false,
  ask_research_mode_default: false,
  show_citations_default: false,
  show_followups: true,
  auto_open_task_drawer: false,
  ai_critique_default: false,
};

export const PREFERENCE_KEYS = {
  sidebarCollapsed: 'clario_sidebar_collapsed',
  sidebarCollapsedDefault: 'clario_sidebar_default_collapsed',
  showQuickAsk: 'clario_show_quick_ask',
  showFooterShortcuts: 'clario_show_shortcuts',
  tableDensity: 'clario_table_density',
  defaultDocumentsView: 'clario_docs_default_view',
  defaultSearchMode: 'clario_default_search_mode',
  askStreamingDefault: 'clario_ask_stream',
  askResearchModeDefault: 'clario_ask_research_mode',
  showCitationsDefault: 'clario_show_citations_default',
  showFollowUps: 'clario_show_followups',
  autoOpenTaskDrawer: 'clario_auto_open_tasks',
  aiCritiqueDefault: 'clario_critique_use_ai',
} as const;

export const UI_PREFERENCES_EVENT = 'clario:ui-preferences-updated';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return val === 'true';
  } catch {
    return fallback;
  }
}

export function loadWorkspacePreferences(): WorkspacePreferences {
  let tableDensity: TableDensity = DEFAULT_WORKSPACE_PREFERENCES.table_density;
  let defaultDocumentsView: DocumentsDefaultView = DEFAULT_WORKSPACE_PREFERENCES.default_documents_view;
  let defaultSearchMode: SearchModePreference = DEFAULT_WORKSPACE_PREFERENCES.default_search_mode;

  try {
    const td = localStorage.getItem(PREFERENCE_KEYS.tableDensity);
    if (td === 'comfortable' || td === 'compact') tableDensity = td;

    const dv = localStorage.getItem(PREFERENCE_KEYS.defaultDocumentsView);
    if (dv === 'grid' || dv === 'table') defaultDocumentsView = dv;

    const sm = localStorage.getItem(PREFERENCE_KEYS.defaultSearchMode);
    if (sm === 'hybrid' || sm === 'bm25' || sm === 'vector') defaultSearchMode = sm;
  } catch {
    // Non-fatal when storage is unavailable
  }

  const sidebarCollapsedDefault = readBool(
    PREFERENCE_KEYS.sidebarCollapsedDefault,
    readBool(PREFERENCE_KEYS.sidebarCollapsed, DEFAULT_WORKSPACE_PREFERENCES.sidebar_collapsed_default)
  );

  return {
    sidebar_collapsed_default: sidebarCollapsedDefault,
    show_quick_ask: readBool(PREFERENCE_KEYS.showQuickAsk, DEFAULT_WORKSPACE_PREFERENCES.show_quick_ask),
    show_footer_shortcuts: readBool(PREFERENCE_KEYS.showFooterShortcuts, DEFAULT_WORKSPACE_PREFERENCES.show_footer_shortcuts),
    table_density: tableDensity,
    default_documents_view: defaultDocumentsView,
    default_search_mode: defaultSearchMode,
    ask_streaming_default: readBool(PREFERENCE_KEYS.askStreamingDefault, DEFAULT_WORKSPACE_PREFERENCES.ask_streaming_default),
    ask_research_mode_default: readBool(PREFERENCE_KEYS.askResearchModeDefault, DEFAULT_WORKSPACE_PREFERENCES.ask_research_mode_default),
    show_citations_default: readBool(PREFERENCE_KEYS.showCitationsDefault, DEFAULT_WORKSPACE_PREFERENCES.show_citations_default),
    show_followups: readBool(PREFERENCE_KEYS.showFollowUps, DEFAULT_WORKSPACE_PREFERENCES.show_followups),
    auto_open_task_drawer: readBool(PREFERENCE_KEYS.autoOpenTaskDrawer, DEFAULT_WORKSPACE_PREFERENCES.auto_open_task_drawer),
    ai_critique_default: readBool(PREFERENCE_KEYS.aiCritiqueDefault, DEFAULT_WORKSPACE_PREFERENCES.ai_critique_default),
  };
}

export function applyWorkspacePreferences(
  prefs: Partial<WorkspacePreferences>,
  options?: { syncSidebarState?: boolean }
): WorkspacePreferences {
  const merged: WorkspacePreferences = {
    ...loadWorkspacePreferences(),
    ...prefs,
  };

  try {
    localStorage.setItem(PREFERENCE_KEYS.sidebarCollapsedDefault, String(merged.sidebar_collapsed_default));
    if (options?.syncSidebarState) {
      localStorage.setItem(PREFERENCE_KEYS.sidebarCollapsed, String(merged.sidebar_collapsed_default));
    }
    localStorage.setItem(PREFERENCE_KEYS.showQuickAsk, String(merged.show_quick_ask));
    localStorage.setItem(PREFERENCE_KEYS.showFooterShortcuts, String(merged.show_footer_shortcuts));
    localStorage.setItem(PREFERENCE_KEYS.tableDensity, merged.table_density);
    localStorage.setItem(PREFERENCE_KEYS.defaultDocumentsView, merged.default_documents_view);
    localStorage.setItem(PREFERENCE_KEYS.defaultSearchMode, merged.default_search_mode);
    localStorage.setItem(PREFERENCE_KEYS.askStreamingDefault, String(merged.ask_streaming_default));
    localStorage.setItem(PREFERENCE_KEYS.askResearchModeDefault, String(merged.ask_research_mode_default));
    localStorage.setItem(PREFERENCE_KEYS.showCitationsDefault, String(merged.show_citations_default));
    localStorage.setItem(PREFERENCE_KEYS.showFollowUps, String(merged.show_followups));
    localStorage.setItem(PREFERENCE_KEYS.autoOpenTaskDrawer, String(merged.auto_open_task_drawer));
    localStorage.setItem(PREFERENCE_KEYS.aiCritiqueDefault, String(merged.ai_critique_default));
  } catch {
    // Ignore storage errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT, { detail: { prefs: merged, syncSidebarState: options?.syncSidebarState } }));
  }

  return merged;
}

export function resetWorkspacePreferences(): WorkspacePreferences {
  return applyWorkspacePreferences(DEFAULT_WORKSPACE_PREFERENCES, { syncSidebarState: true });
}
