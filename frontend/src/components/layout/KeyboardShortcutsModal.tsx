import React, { useEffect } from 'react';
import { Keyboard, X, Command, ArrowRight, CornerDownLeft } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys?: string[];
  altKeys?: string[];
  sequence?: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Global Commands',
      shortcuts: [
        { keys: ['⌘', 'K'], altKeys: ['Ctrl', 'K'], label: 'Open Command Palette & Passage Search' },
        { keys: ['?'], label: 'Show Keyboard Shortcuts HUD' },
        { keys: ['Esc'], label: 'Close Active Modal, Drawer, or Palette' },
      ],
    },
    {
      title: 'Navigation Sequence (Press G then letter)',
      shortcuts: [
        { sequence: ['G', 'O'], label: 'Go to Portfolio Overview' },
        { sequence: ['G', 'D'], label: 'Go to Document Library' },
        { sequence: ['G', 'A'], label: 'Go to Ask Clario & Evidence Workspace' },
        { sequence: ['G', 'C'], label: 'Go to Version & Diff Compare' },
        { sequence: ['G', 'N'], label: 'Go to Clause Redline & Playbooks' },
        { sequence: ['G', 'M'], label: 'Go to Multi-Standard Compliance Matrix' },
        { sequence: ['G', 'S'], label: 'Go to Engine & IR Tuning Settings' },
      ],
    },
    {
      title: 'Document & Table Operations',
      shortcuts: [
        { keys: ['Density'], label: 'Switch between Compact & Comfortable density' },
        { keys: ['Click Checkbox'], label: 'Multi-select documents for JSON/CSV bulk export' },
        { keys: ['Select 2 Docs'], label: 'One-click Side-by-Side Redline Diff' },
      ],
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" maxWidth="2xl">
      <div className="p-6 space-y-6 bg-white text-slate-900">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700">
            <Keyboard className="w-5 h-5 text-clario-navy" />
            <span className="text-xs text-slate-500">
              Execute actions, jump across modules, and inspect documents without leaving the keyboard.
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-clario-text-secondary">
                {group.title}
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden bg-slate-50/50">
                {group.shortcuts.map((sc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-50 transition-colors text-xs"
                  >
                    <span className="text-slate-700 font-medium">{sc.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sc.keys && (
                        <div className="flex items-center gap-1">
                          {sc.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-800 font-mono text-[11px] font-semibold shadow-2xs"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      )}
                      {sc.sequence && (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-800 font-semibold shadow-2xs">
                            {sc.sequence[0]}
                          </kbd>
                          <span className="text-slate-400 text-[10px]">then</span>
                          <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-800 font-semibold shadow-2xs">
                            {sc.sequence[1]}
                          </kbd>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded-md border text-slate-600 font-mono text-[10px]">?</kbd> anywhere to toggle this cheat sheet.</span>
          <span className="text-slate-600 font-medium">Clario Navigation HUD</span>
        </div>
      </div>
    </Modal>
  );
};
