import { PageHeader } from '../components/layout/PageHeader';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  FileText,
  AlertTriangle,
  Layers,
  BookOpen,
  ArrowRight,
  Search,
  Scale,
  CheckCircle2,
  Table,
  ListTree,
  ChevronRight,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { GraphDataResponse, GraphNode, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';
import { ClauseNegotiatorModal } from '../components/negotiate/ClauseNegotiatorModal';

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export const KnowledgeGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<GraphDataResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Network Map, Cross-Agreement Matrix, or Corpus Hierarchy
  const [viewMode, setViewMode] = useState<'network' | 'matrix' | 'hierarchy'>('network');
  const [layoutStyle, setLayoutStyle] = useState<'clusters' | 'radial'>('clusters');

  // Filters
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({
    document: true,
    topic: true,
    finding: true,
    chunk: true,
  });

  // Selected Node & Inspection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);
  const [negotiateNode, setNegotiateNode] = useState<GraphNode | null>(null);

  // Pan & Zoom & Node Dragging
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;

  const [isDragging, setIsDragging] = useState(false);

  // Individual node dragging state
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingClusterIds, setDraggingClusterIds] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);

  const fetchGraph = async (docIds?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getKnowledgeGraph(docIds && docIds.length > 0 ? docIds : undefined);
      setData(res);
      // If there are many documents (6+), default citations layer off to prevent visual clutter
      if (res && res.stats.total_documents >= 6) {
        setVisibleTypes((prev) => ({ ...prev, chunk: false }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getDocuments().then((docs) => setDocuments(docs)).catch(() => {});
    fetchGraph();
  }, []);

  const toggleDocumentScope = (docId: string) => {
    const next = selectedDocIds.includes(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...selectedDocIds, docId];
    setSelectedDocIds(next);
    setSelectedNodeId(null);
    setCustomPositions({});
    fetchGraph(next);
  };

  const selectAllDocuments = () => {
    setSelectedDocIds([]);
    setSelectedNodeId(null);
    setCustomPositions({});
    fetchGraph([]);
  };

  // Filter nodes & edges
  const filteredNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((node) => {
      if (!visibleTypes[node.type]) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          node.label.toLowerCase().includes(query) ||
          node.type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data, visibleTypes, searchQuery]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    if (data) {
      data.nodes.forEach((n) => map.set(n.id, n));
    }
    return map;
  }, [data]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    const activeMap = new Map<string, GraphNode>();
    filteredNodes.forEach((n) => activeMap.set(n.id, n));
    return data.edges.filter(
      (edge) => activeMap.has(edge.source) && activeMap.has(edge.target)
    );
  }, [data, filteredNodes]);

  // Compute Layout Positions (Clusters Constellation Layout vs Concentric Orbit)
  const baseLayoutNodes = useMemo<LayoutNode[]>(() => {
    if (!filteredNodes.length) return [];
    const width = 900;
    const height = 640;
    const centerX = width / 2;
    const centerY = height / 2;

    const docs = filteredNodes.filter((n) => n.type === 'document');
    const topics = filteredNodes.filter((n) => n.type === 'topic');
    const findings = filteredNodes.filter((n) => n.type === 'finding');
    const chunks = filteredNodes.filter((n) => n.type === 'chunk');

    const result: LayoutNode[] = [];

    // Fallback radial layout if user explicitly switches to radial
    if (layoutStyle === 'radial' || docs.length <= 1) {
      docs.forEach((doc, idx) => {
        const angle = (idx / Math.max(docs.length, 1)) * 2 * Math.PI - Math.PI / 2;
        const radius = docs.length === 1 ? 0 : 70;
        result.push({
          ...doc,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });

      topics.forEach((topic, idx) => {
        const angle = (idx / Math.max(topics.length, 1)) * 2 * Math.PI;
        const radius = 145;
        result.push({
          ...topic,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });

      findings.forEach((finding, idx) => {
        const angle = (idx / Math.max(findings.length, 1)) * 2 * Math.PI + Math.PI / 4;
        const radius = 210;
        result.push({
          ...finding,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });

      chunks.forEach((chunk, idx) => {
        const angle = (idx / Math.max(chunks.length, 1)) * 2 * Math.PI - Math.PI / 4;
        const radius = 255;
        result.push({
          ...chunk,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });

      return result;
    }

    // CLUSTER CONSTELLATION LAYOUT (Multi-Hub)
    // Solves the 7-8+ documents crowding problem by dedicating a clean constellation to each document!
    const docHubs: Record<string, { x: number; y: number }> = {};
    const nDocs = docs.length;

    if (nDocs === 2) {
      docHubs[docs[0].id] = { x: centerX - 220, y: centerY };
      docHubs[docs[1].id] = { x: centerX + 220, y: centerY };
    } else {
      const docOrbitRadius = Math.max(220, 26 * nDocs);
      docs.forEach((doc, idx) => {
        const angle = (idx / nDocs) * 2 * Math.PI - Math.PI / 2;
        docHubs[doc.id] = {
          x: centerX + docOrbitRadius * 1.15 * Math.cos(angle),
          y: centerY + docOrbitRadius * 0.9 * Math.sin(angle),
        };
      });
    }

    // Place document nodes at their hubs
    docs.forEach((doc) => {
      const hub = docHubs[doc.id] || { x: centerX, y: centerY };
      result.push({
        ...doc,
        x: hub.x,
        y: hub.y,
      });
    });

    // Group child nodes by document parent
    const docTopics: Record<string, GraphNode[]> = {};
    const docChunks: Record<string, GraphNode[]> = {};
    const docFindings: Record<string, GraphNode[]> = {};
    const sharedFindings: GraphNode[] = [];
    const orphanNodes: GraphNode[] = [];

    const getDocParentId = (node: GraphNode): string | null => {
      if (node.metadata?.document_id) {
        return `doc_${node.metadata.document_id}`;
      }
      for (const edge of filteredEdges) {
        if (edge.source.startsWith('doc_') && edge.target === node.id) {
          return edge.source;
        }
        if (edge.target.startsWith('doc_') && edge.source === node.id) {
          return edge.target;
        }
      }
      return null;
    };

    topics.forEach((t) => {
      const pId = getDocParentId(t);
      if (pId && docHubs[pId]) {
        if (!docTopics[pId]) docTopics[pId] = [];
        docTopics[pId].push(t);
      } else {
        orphanNodes.push(t);
      }
    });

    chunks.forEach((c) => {
      const pId = getDocParentId(c);
      if (pId && docHubs[pId]) {
        if (!docChunks[pId]) docChunks[pId] = [];
        docChunks[pId].push(c);
      } else {
        orphanNodes.push(c);
      }
    });

    findings.forEach((f) => {
      const docAId = f.metadata?.doc_a_id ? `doc_${f.metadata.doc_a_id}` : null;
      const docBId = f.metadata?.doc_b_id ? `doc_${f.metadata.doc_b_id}` : null;
      if (docAId && docBId && docHubs[docAId] && docHubs[docBId] && docAId !== docBId) {
        sharedFindings.push(f);
      } else {
        const pId = docAId || docBId || getDocParentId(f);
        if (pId && docHubs[pId]) {
          if (!docFindings[pId]) docFindings[pId] = [];
          docFindings[pId].push(f);
        } else {
          sharedFindings.push(f);
        }
      }
    });

    // Orbit children around their respective document hub
    docs.forEach((doc) => {
      const hub = docHubs[doc.id];
      if (!hub) return;

      const dTopics = docTopics[doc.id] || [];
      dTopics.forEach((t, i) => {
        const angle = (i / Math.max(dTopics.length, 1)) * 2 * Math.PI;
        const radius = 68;
        result.push({
          ...t,
          x: hub.x + radius * Math.cos(angle),
          y: hub.y + radius * Math.sin(angle),
        });
      });

      const dFindings = docFindings[doc.id] || [];
      dFindings.forEach((f, i) => {
        const angle = (i / Math.max(dFindings.length, 1)) * 2 * Math.PI + Math.PI / 4;
        const radius = 98;
        result.push({
          ...f,
          x: hub.x + radius * Math.cos(angle),
          y: hub.y + radius * Math.sin(angle),
        });
      });

      const dChunks = docChunks[doc.id] || [];
      dChunks.forEach((c, i) => {
        const angle = (i / Math.max(dChunks.length, 1)) * 2 * Math.PI + Math.PI / 6;
        const radius = 128;
        result.push({
          ...c,
          x: hub.x + radius * Math.cos(angle),
          y: hub.y + radius * Math.sin(angle),
        });
      });
    });

    // Place shared / bilateral findings at the midpoint between their connected documents
    sharedFindings.forEach((f, i) => {
      const docAId = f.metadata?.doc_a_id ? `doc_${f.metadata.doc_a_id}` : null;
      const docBId = f.metadata?.doc_b_id ? `doc_${f.metadata.doc_b_id}` : null;
      if (docAId && docBId && docHubs[docAId] && docHubs[docBId]) {
        const hubA = docHubs[docAId];
        const hubB = docHubs[docBId];
        const midX = (hubA.x + hubB.x) / 2;
        const midY = (hubA.y + hubB.y) / 2;
        const spread = ((i % 3) - 1) * 22;
        result.push({
          ...f,
          x: midX * 0.78 + centerX * 0.22 + spread,
          y: midY * 0.78 + centerY * 0.22 + spread,
        });
      } else {
        const angle = (i / Math.max(sharedFindings.length, 1)) * 2 * Math.PI;
        const radius = 80;
        result.push({
          ...f,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      }
    });

    // Place any remaining orphan nodes in inner core
    orphanNodes.forEach((node, i) => {
      const angle = (i / Math.max(orphanNodes.length, 1)) * 2 * Math.PI;
      const radius = 60;
      result.push({
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return result;
  }, [filteredNodes, layoutStyle, filteredEdges]);

  // Combine with custom user-dragged positions so moved dots stay placed
  const layoutNodes = useMemo<LayoutNode[]>(() => {
    return baseLayoutNodes.map((node) => {
      const custom = customPositions[node.id];
      if (custom) {
        return { ...node, x: custom.x, y: custom.y };
      }
      return node;
    });
  }, [baseLayoutNodes, customPositions]);

  const layoutNodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    layoutNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [layoutNodes]);

  // Connected nodes & edges for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>([selectedNodeId]);
    filteredEdges.forEach((e) => {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    });
    return set;
  }, [selectedNodeId, filteredEdges]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodeMap.get(selectedNodeId) || null : null),
    [selectedNodeId, nodeMap]
  );

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return filteredEdges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );
  }, [selectedNodeId, filteredEdges]);

  // Top Topics extracted across all documents for Cross-Agreement Matrix View
  const matrixTopics = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { label: string; count: number }>();
    data.nodes
      .filter((n) => n.type === 'topic')
      .forEach((t) => {
        const clean = t.label.replace(/^Sheet:\s*/i, '').trim();
        const existing = map.get(clean);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(clean, { label: clean, count: 1 });
        }
      });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  // Canvas pan & drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    let didCanvasMove = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialPanX = panRef.current.x;
    const initialPanY = panRef.current.y;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didCanvasMove = true;
      }
      setPan({
        x: initialPanX + dx,
        y: initialPanY + dy,
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!didCanvasMove) {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.4), 2.5);
      return Math.round(next * 100) / 100;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
    setCustomPositions({});
  };

  const handleResetPositions = () => {
    setCustomPositions({});
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
    setSelectedNodeId(null);
  };

  const getNodeFill = (type: string) => {
    switch (type) {
      case 'document':
        return 'url(#gradNavy)';
      case 'topic':
        return 'url(#gradTopic)';
      case 'finding':
        return 'url(#gradRose)';
      case 'chunk':
      default:
        return 'url(#gradSlate)';
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: LayoutNode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;

    setDraggingNodeId(node.id);
    setDraggingClusterIds(new Set());

    let didMove = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startZoom = zoomRef.current;
    const initialPos = { x: node.x, y: node.y };

    const onMove = (moveEvt: MouseEvent) => {
      const dxScreen = moveEvt.clientX - startClientX;
      const dyScreen = moveEvt.clientY - startClientY;
      if (Math.abs(dxScreen) > 3 || Math.abs(dyScreen) > 3) {
        didMove = true;
      }
      const deltaGraphX = dxScreen / startZoom;
      const deltaGraphY = dyScreen / startZoom;
      setCustomPositions((prev) => ({
        ...prev,
        [node.id]: {
          x: initialPos.x + deltaGraphX,
          y: initialPos.y + deltaGraphY,
        },
      }));
    };

    const onUp = () => {
      setDraggingNodeId(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!didMove) {
        setSelectedNodeId(node.id);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Knowledge graph"
        description="Explore cross-document provisions, semantic topic clusters, and detected contractual contradictions."
      >
        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('network')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'network'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Constellation Network</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'matrix'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Cross-Agreement Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('hierarchy')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'hierarchy'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Corpus Hierarchy</span>
          </button>
        </div>
      </PageHeader>

      {/* Metric Stats Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">Indexed Documents</span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_documents}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Corpus scope</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">Semantic Topics</span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_topics}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Discovered clusters</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">Flagged Findings</span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_findings}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Contradictions</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">Active Nodes</span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <Network className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_nodes}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">
              {filteredEdges.length} connected edges
            </span>
          </Card>
        </div>
      )}

      {/* Multi-Document Scope Selector Bar */}
      {documents.length > 0 && (
        <Card className="p-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-800 font-semibold flex items-center gap-1.5 mr-1 shrink-0 text-xs">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              Document Scope:
            </span>
            <button
              type="button"
              aria-pressed={selectedDocIds.length === 0}
              onClick={selectAllDocuments}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedDocIds.length === 0
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All Workspace Documents ({documents.length})
            </button>
            {documents.map((d) => {
              const isSelected = selectedDocIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleDocumentScope(d.id)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 max-w-[260px] min-w-0 border ${
                    isSelected
                      ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title={`${d.title} (${d.file_type.toUpperCase()})`}
                >
                  <span className="truncate min-w-0 block flex-1 text-left">{d.title}</span>
                  <span
                    className={`text-[10px] font-mono shrink-0 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    ({d.file_type.toUpperCase()})
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Control Toolbar (Used for Network Map & Global Filtering) */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Node Filter Toggles */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Layers:
            </span>

            <button
              type="button"
              onClick={() => toggleType('document')}
              className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.document
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Documents
            </button>

            <button
              type="button"
              onClick={() => toggleType('topic')}
              className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.topic
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-300" />
              Topics
            </button>

            <button
              type="button"
              onClick={() => toggleType('finding')}
              className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.finding
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-300" />
              Contradictions
            </button>

            <button
              type="button"
              onClick={() => toggleType('chunk')}
              className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.chunk
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle excerpt citation nodes (hidden by default in multi-document mode to reduce clutter)"
            >
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Citations
            </button>
          </div>

          {/* Search, Layout Switcher & Canvas Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === 'network' && (
              <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutStyle('clusters')}
                  className={`px-2 py-1 rounded text-[11px] transition-all ${
                    layoutStyle === 'clusters'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Cluster nodes into distinct document constellations to prevent overlapping"
                >
                  Constellations
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutStyle('radial')}
                  className={`px-2 py-1 rounded text-[11px] transition-all ${
                    layoutStyle === 'radial'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Concentric circular orbit layout"
                >
                  Concentric
                </button>
              </div>
            )}

            {Object.keys(customPositions).length > 0 && viewMode === 'network' && (
              <button
                type="button"
                onClick={handleResetPositions}
                className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 font-medium bg-white shadow-xs"
                title="Reset moved dots back to automatic layout"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Reset Nodes ({Object.keys(customPositions).length})
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find node or topic..."
                className="text-xs pl-8 pr-2.5 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 w-36 sm:w-44 bg-white"
              />
            </div>

            {viewMode === 'network' && (
              <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => handleZoom(0.15)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 border-r border-slate-200 hover:bg-slate-100 transition-colors focus:outline-none"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoom(-0.15)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 border-r border-slate-200 hover:bg-slate-100 transition-colors focus:outline-none"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
                  title="Reset View and Positions"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Visualizer + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* VIEW 1: Network Canvas */}
        {viewMode === 'network' && (
          <div className="lg:col-span-3 border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs relative h-[480px] sm:h-[560px] lg:h-[660px] select-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                <p className="text-xs">Constructing semantic relationship graph...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-rose-500 p-6">
                <AlertTriangle className="w-8 h-8 mb-2" />
                <p className="text-xs">{error}</p>
              </div>
            ) : !data || data.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50/50">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
                  <Network className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">No Knowledge Topology Available</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Upload contracts or vendor agreements in the Document Library to index provisions, map citations, and visualize cross-clause relationships.
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/documents')}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Go to Document Library
                </Button>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* Top Interaction Guide Chip */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-md px-2.5 py-1 text-[11px] text-slate-500 shadow-xs pointer-events-none flex items-center gap-2 z-10">
                  <span className="font-semibold text-slate-800">
                    {layoutStyle === 'clusters' ? 'Constellation View (Multi-Document)' : 'Concentric Orbit View'}
                  </span>
                  <span>•</span>
                  <span>Drag dot to reposition</span>
                  <span>•</span>
                  <span>Drag canvas to pan</span>
                  {!visibleTypes.chunk && (
                    <>
                      <span>•</span>
                      <span className="text-slate-600 font-medium">Citations collapsed for clarity</span>
                    </>
                  )}
                </div>

                <svg
                  ref={svgRef}
                  className={`w-full h-full ${
                    draggingNodeId ? 'cursor-grabbing' : isDragging ? 'cursor-grabbing' : 'cursor-default'
                  }`}
                  onMouseDown={handleCanvasMouseDown}
                >
                  <defs>
                    <pattern id="graphGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#E2E8F0" />
                    </pattern>
                    <linearGradient id="gradNavy" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1E293B" />
                      <stop offset="100%" stopColor="#0F172A" />
                    </linearGradient>
                    <linearGradient id="gradTopic" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>
                    <linearGradient id="gradRose" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F43F5E" />
                      <stop offset="100%" stopColor="#BE123C" />
                    </linearGradient>
                    <linearGradient id="gradSlate" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#64748B" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                  </defs>

                  <rect width="100%" height="100%" fill="url(#graphGrid)" />

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Edge Lines */}
                    {filteredEdges.map((edge) => {
                      const source = layoutNodeMap.get(edge.source);
                      const target = layoutNodeMap.get(edge.target);
                      if (!source || !target) return null;

                      const isHighlighted =
                        selectedNodeId &&
                        (edge.source === selectedNodeId || edge.target === selectedNodeId);
                      const isDimmed = selectedNodeId && !isHighlighted;

                      return (
                        <g key={edge.id}>
                          <line
                            x1={source.x}
                            y1={source.y}
                            x2={target.x}
                            y2={target.y}
                            stroke={isHighlighted ? '#0F172A' : edge.color || '#CBD5E1'}
                            strokeWidth={isHighlighted ? 2.5 : edge.weight || 1.2}
                            strokeDasharray={edge.dashed ? '4,4' : undefined}
                            opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.75}
                            className="transition-all duration-150"
                          />
                        </g>
                      );
                    })}

                    {/* Node Circles & Labels */}
                    {layoutNodes.map((node) => {
                      const isSelected = node.id === selectedNodeId;
                      const isConnected = connectedNodeIds.has(node.id);
                      const isDimmed = selectedNodeId && !isSelected && !isConnected;
                      const isHovered = node.id === hoveredNodeId;
                      const isBeingDragged = draggingNodeId === node.id;
                      const isInActiveDraggedCluster =
                        draggingClusterIds.has(node.id) && !isBeingDragged;

                      const nodeRadius = node.size ? Math.max(node.size * 0.85, 12) : 16;
                      const fill = getNodeFill(node.type);

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseDown={(e) => handleNodeMouseDown(e, node)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          className={`transition-opacity duration-150 ${
                            isBeingDragged ? 'cursor-grabbing' : 'cursor-grab'
                          }`}
                          opacity={isDimmed ? 0.18 : 1}
                        >
                          {isBeingDragged && (
                            <circle
                              r={nodeRadius + 8}
                              fill="none"
                              stroke="#2563EB"
                              strokeWidth={2}
                              strokeDasharray="4,3"
                              opacity={0.9}
                            />
                          )}

                          {isInActiveDraggedCluster && (
                            <circle
                              r={nodeRadius + 6}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth={1.5}
                              strokeDasharray="3,3"
                              opacity={0.7}
                            />
                          )}

                          {(isSelected || isHovered) && !isBeingDragged && (
                            <circle
                              r={nodeRadius + 6}
                              fill="none"
                              stroke={node.type === 'finding' ? '#E11D48' : '#0F172A'}
                              strokeWidth={2}
                              strokeDasharray={isSelected ? undefined : '3,3'}
                              opacity={0.85}
                            />
                          )}

                          <circle
                            r={nodeRadius}
                            fill={fill}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                            className="shadow-sm"
                          />

                          <circle r={2.5} fill="#FFFFFF" />

                          <text
                            y={nodeRadius + 14}
                            textAnchor="middle"
                            fontSize={node.type === 'document' ? '12px' : '10px'}
                            fontWeight={node.type === 'document' || isSelected ? '600' : '500'}
                            fill="#0F172A"
                            className="pointer-events-none select-none"
                            style={{
                              textShadow:
                                '0 1px 3px rgba(255,255,255,0.9), 0 -1px 3px rgba(255,255,255,0.9)',
                            }}
                          >
                            {node.label.length > 24 ? `${node.label.slice(0, 22)}…` : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            )}

            {/* Quick Graph Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-md px-3 py-2 text-[10px] space-y-1 shadow-xs pointer-events-none text-slate-700">
              <div className="font-semibold text-slate-900 uppercase tracking-wider text-[9px]">
                Topology Legend
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                  <span className="text-slate-600">Document Hub</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  <span className="text-slate-600">Topic</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                  <span className="text-slate-600">Contradiction</span>
                </span>
                {visibleTypes.chunk && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
                    <span className="text-slate-600">Citation</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Cross-Agreement Matrix View */}
        {viewMode === 'matrix' && (
          <div className="lg:col-span-3 border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Cross-Agreement Clause & Discrepancy Matrix
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Multi-contract comparative grid mapping counterparties against key legal categories and flagged contradictions.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Active Clause
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Risk Discrepancy
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px] tracking-wider min-w-[200px] sticky left-0 bg-slate-100/90 z-10 border-r border-slate-200">
                      Audited Document
                    </th>
                    {matrixTopics.map((topic, idx) => (
                      <th
                        key={idx}
                        className="py-2.5 px-3 font-semibold uppercase text-[10px] tracking-wider min-w-[130px] border-r border-slate-200/60"
                      >
                        {topic.label}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px] tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const docNode = nodeMap.get(`doc_${doc.id}`);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-900 sticky left-0 bg-white hover:bg-slate-50/90 border-r border-slate-200 z-10">
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(`doc_${doc.id}`)}
                            className="text-left group flex items-start gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-900 group-hover:text-clario-navy block truncate max-w-[190px]">
                                {doc.title}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {doc.file_type.toUpperCase()} • {doc.chunk_count} chunks
                              </span>
                            </div>
                          </button>
                        </td>

                        {matrixTopics.map((topic, tIdx) => {
                          // Check if there is a contradiction / finding linking this doc on this topic
                          const findingNode = data?.nodes.find((n) => {
                            if (n.type !== 'finding') return false;
                            const matchesDoc =
                              n.metadata?.doc_a_id === doc.id || n.metadata?.doc_b_id === doc.id;
                            const matchesTopic =
                              n.label.toLowerCase().includes(topic.label.toLowerCase()) ||
                              (n.metadata?.description || '')
                                .toLowerCase()
                                .includes(topic.label.toLowerCase());
                            return matchesDoc && matchesTopic;
                          });

                          // Check if doc has an active topic node
                          const topicNode = data?.nodes.find((n) => {
                            if (n.type !== 'topic') return false;
                            return (
                              n.metadata?.document_id === doc.id &&
                              n.label.toLowerCase().includes(topic.label.toLowerCase())
                            );
                          });

                          return (
                            <td key={tIdx} className="py-2.5 px-2.5 border-r border-slate-100">
                              {findingNode ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedNodeId(findingNode.id)}
                                  className="w-full text-left p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 transition-colors flex items-center justify-between gap-1 shadow-2xs"
                                  title={`${findingNode.label}: ${findingNode.metadata?.description || ''}`}
                                >
                                  <div className="truncate">
                                    <span className="text-[10px] font-bold block truncate">
                                      Discrepancy
                                    </span>
                                    <span className="text-[9px] text-rose-600 block truncate">
                                      {findingNode.label}
                                    </span>
                                  </div>
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                </button>
                              ) : topicNode ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedNodeId(topicNode.id)}
                                  className="w-full text-left p-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors flex items-center justify-between gap-1 shadow-2xs"
                                  title={topicNode.label}
                                >
                                  <span className="text-[10px] font-medium truncate block">
                                    Clause Active
                                  </span>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                </button>
                              ) : (
                                <span className="text-slate-300 font-mono text-center block">—</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setViewerDocId(doc.id)}
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 hover:underline"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: Corpus Hierarchy View */}
        {viewMode === 'hierarchy' && (
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
                Corpus Tree & Provision Hierarchy
              </h3>
              <p className="text-[11px] text-slate-500">
                Structured legal taxonomy organizing documents by their extracted provisions, risk contradictions, and supporting evidence.
              </p>
            </Card>

            <div className="space-y-3">
              {documents.map((doc) => {
                const docTopics =
                  data?.nodes.filter(
                    (n) => n.type === 'topic' && n.metadata?.document_id === doc.id
                  ) || [];
                const docFindings =
                  data?.nodes.filter(
                    (n) =>
                      n.type === 'finding' &&
                      (n.metadata?.doc_a_id === doc.id || n.metadata?.doc_b_id === doc.id)
                  ) || [];

                return (
                  <Card key={doc.id} className="p-4 bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{doc.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {doc.file_type.toUpperCase()} • {doc.page_count} pages • {doc.chunk_count} chunks
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedNodeId(`doc_${doc.id}`)}
                          className="text-xs"
                        >
                          Inspect Node
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewerDocId(doc.id)}
                          className="text-xs"
                        >
                          <BookOpen className="w-3 h-3 mr-1" />
                          View Document
                        </Button>
                      </div>
                    </div>

                    {/* Topics Subsections */}
                    {docTopics.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                          Discovered Sections & Clauses ({docTopics.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {docTopics.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedNodeId(t.id)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flagged Contradictions / Findings */}
                    {docFindings.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider block">
                          Flagged Contradictions & Exposures ({docFindings.length})
                        </span>
                        <div className="space-y-1.5">
                          {docFindings.map((f) => (
                            <div
                              key={f.id}
                              onClick={() => setSelectedNodeId(f.id)}
                              className="p-2.5 rounded-md bg-rose-50/60 border border-rose-200 text-xs flex items-center justify-between gap-3 cursor-pointer hover:bg-rose-50 transition-colors"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-rose-950">{f.label}</span>
                                  <Badge
                                    variant={
                                      f.metadata?.severity === 'critical' ? 'red' : 'gold'
                                    }
                                    size="sm"
                                  >
                                    {f.metadata?.severity || 'risk'}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-rose-800 line-clamp-1">
                                  {f.metadata?.description}
                                </p>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Node Inspector Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 bg-white shadow-subtle border border-slate-200 rounded-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-clario-navy">Node Inspector</span>
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {selectedNode ? (
              <div className="pt-3 space-y-3.5">
                <div>
                  <Badge
                    variant={
                      selectedNode.type === 'document'
                        ? 'navy'
                        : selectedNode.type === 'topic'
                        ? 'teal'
                        : selectedNode.type === 'finding'
                        ? 'red'
                        : 'gray'
                    }
                  >
                    {selectedNode.type.toUpperCase()}
                  </Badge>
                  <h4 className="text-sm font-bold text-clario-navy mt-1.5 leading-snug">
                    {selectedNode.label}
                  </h4>
                </div>

                {/* Node Specific Metadata */}
                {selectedNode.metadata && (
                  <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 space-y-1.5 text-xs text-slate-600">
                    {Object.entries(selectedNode.metadata).map(([key, val]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          {key.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-800 break-words">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {selectedNode.type === 'document' && selectedNode.metadata?.document_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewerDocId(selectedNode.metadata?.document_id)}
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Open in Document Viewer</span>
                  </Button>
                )}

                {selectedNode.type === 'finding' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setNegotiateNode(selectedNode)}
                    className="w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Draft Redline Amendment</span>
                  </Button>
                )}

                {/* Connected Edges */}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                    Direct Connections ({selectedNodeEdges.length})
                  </span>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {selectedNodeEdges.map((edge) => {
                      const otherId =
                        edge.source === selectedNode.id ? edge.target : edge.source;
                      const otherNode = nodeMap.get(otherId);
                      if (!otherNode) return null;

                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => setSelectedNodeId(otherId)}
                          className="w-full text-left p-2 rounded-md border border-slate-100 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="truncate mr-2">
                            <span className="text-[10px] uppercase text-slate-400 block">
                              {edge.type}
                            </span>
                            <span className="font-medium text-slate-800 truncate block">
                              {otherNode.label}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-8 pb-8 text-center text-slate-400 space-y-2">
                <Network className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">
                  Click any node or cell in the graph to inspect its properties, evidence citations, and relationships.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewerDocId && (
        <DocumentViewerModal
          documentId={viewerDocId}
          onClose={() => setViewerDocId(null)}
        />
      )}

      {/* Clause Negotiator Modal */}
      {negotiateNode && (
        <ClauseNegotiatorModal
          isOpen={!!negotiateNode}
          onClose={() => setNegotiateNode(null)}
          findingId={negotiateNode.metadata?.finding_id}
          topic={negotiateNode.label}
          statementA={negotiateNode.metadata?.description}
          statementB={negotiateNode.metadata?.description}
          docATitle={negotiateNode.metadata?.doc_a_title}
          docBTitle={negotiateNode.metadata?.doc_b_title}
          onSaved={() => fetchGraph(selectedDocIds)}
        />
      )}
    </div>
  );
};
