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
  ExternalLink,
  Search,
  Scale,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { api } from '../services/api';
import { GraphDataResponse, GraphNode, GraphEdge, DocumentItem } from '../types';
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
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getDocuments().then(docs => setDocuments(docs)).catch(() => {});
    fetchGraph();
  }, []);

  const toggleDocumentScope = (docId: string) => {
    const next = selectedDocIds.includes(docId)
      ? selectedDocIds.filter(id => id !== docId)
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
    filteredNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    return data.edges.filter(
      (edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target)
    );
  }, [data, nodeMap]);

  // Compute default positions using radial layout
  const baseLayoutNodes = useMemo<LayoutNode[]>(() => {
    if (!filteredNodes.length) return [];
    const width = 900;
    const height = 620;
    const centerX = width / 2;
    const centerY = height / 2;

    const docs = filteredNodes.filter((n) => n.type === 'document');
    const topics = filteredNodes.filter((n) => n.type === 'topic');
    const findings = filteredNodes.filter((n) => n.type === 'finding');
    const chunks = filteredNodes.filter((n) => n.type === 'chunk');

    const result: LayoutNode[] = [];

    // Documents placed at core center
    docs.forEach((doc, idx) => {
      const angle = (idx / Math.max(docs.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = docs.length === 1 ? 0 : 70;
      result.push({
        ...doc,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // Topics in mid orbit
    topics.forEach((topic, idx) => {
      const angle = (idx / Math.max(topics.length, 1)) * 2 * Math.PI;
      const radius = 145;
      result.push({
        ...topic,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // Findings in outer lower/upper arcs
    findings.forEach((finding, idx) => {
      const angle = (idx / Math.max(findings.length, 1)) * 2 * Math.PI + Math.PI / 4;
      const radius = 210;
      result.push({
        ...finding,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // Chunks clustered near outer perimeter
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
  }, [filteredNodes]);

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

  // Canvas pan & drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    let didCanvasMove = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialPanX = panRef.current.x;
    const initialPanY = panRef.current.y;

    const onMove = (moveEvt: MouseEvent) => {
      const dx = Math.abs(moveEvt.clientX - startClientX);
      const dy = Math.abs(moveEvt.clientY - startClientY);
      if (dx > 3 || dy > 3) {
        didCanvasMove = true;
      }
      setPan({
        x: initialPanX + (moveEvt.clientX - startClientX),
        y: initialPanY + (moveEvt.clientY - startClientY),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsDragging(false);
      if (!didCanvasMove) {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getClusterNodeIds = (startNode: LayoutNode): Set<string> => {
    const cluster = new Set<string>([startNode.id]);

    // 1. Resolve document scope: if document, topic, or chunk, collect full document cluster
    let docId =
      startNode.type === 'document'
        ? startNode.metadata?.document_id || startNode.id.replace(/^doc_/, '')
        : startNode.metadata?.document_id;

    // If chunk without direct metadata.document_id, resolve from contains edge
    if (!docId && startNode.type === 'chunk') {
      const parentEdge = filteredEdges.find(
        (e) => (e.target === startNode.id || e.source === startNode.id) && e.type === 'contains'
      );
      if (parentEdge) {
        const parentId = parentEdge.target === startNode.id ? parentEdge.source : parentEdge.target;
        docId = parentId.replace(/^doc_/, '');
      }
    }

    if (docId) {
      const docNodeId = `doc_${docId}`;
      cluster.add(docNodeId);

      // Collect all nodes that share this document_id
      layoutNodes.forEach((n) => {
        const nDocId =
          n.type === 'document'
            ? n.metadata?.document_id || n.id.replace(/^doc_/, '')
            : n.metadata?.document_id;
        if (nDocId && nDocId === docId) {
          cluster.add(n.id);
        }
      });

      // Add all chunks and topics linked to the document via edges
      filteredEdges.forEach((edge) => {
        if (edge.source === docNodeId || edge.target === docNodeId) {
          const otherId = edge.source === docNodeId ? edge.target : edge.source;
          const otherNode = layoutNodeMap.get(otherId);
          if (otherNode && otherNode.type !== 'document') {
            if (edge.type === 'contains' || edge.type === 'governs') {
              cluster.add(otherId);
            }
          }
        }
      });
    }

    // 2. Include directly connected non-document nodes that don't belong to a different document
    filteredEdges.forEach((edge) => {
      let neighborId: string | null = null;
      if (edge.source === startNode.id) neighborId = edge.target;
      else if (edge.target === startNode.id) neighborId = edge.source;

      if (neighborId && !cluster.has(neighborId)) {
        const neighborNode = layoutNodeMap.get(neighborId);
        if (neighborNode && neighborNode.type !== 'document') {
          const nDocId = neighborNode.metadata?.document_id;
          if (!nDocId || !docId || nDocId === docId) {
            cluster.add(neighborId);
          }
        }
      }
    });

    return cluster;
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: LayoutNode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas pan from firing
    const svg = svgRef.current;
    if (!svg) return;

    // Normal dragging moves the grabbed dot independently.
    // Shift+drag moves the connected document cluster.
    const isClusterMode = e.shiftKey;
    const movingIds = isClusterMode ? getClusterNodeIds(node) : new Set<string>([node.id]);

    setDraggingNodeId(node.id);
    if (isClusterMode) {
      setDraggingClusterIds(movingIds);
    } else {
      setDraggingClusterIds(new Set());
    }

    let didMove = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startZoom = zoomRef.current;

    // Snapshot initial positions for all moving nodes
    const initialPositions: Record<string, { x: number; y: number }> = {};
    layoutNodes.forEach((n) => {
      if (movingIds.has(n.id)) {
        initialPositions[n.id] = { x: n.x, y: n.y };
      }
    });

    const onMove = (moveEvt: MouseEvent) => {
      const dxScreen = moveEvt.clientX - startClientX;
      const dyScreen = moveEvt.clientY - startClientY;
      if (Math.abs(dxScreen) > 3 || Math.abs(dyScreen) > 3) {
        didMove = true;
      }

      const deltaGraphX = dxScreen / startZoom;
      const deltaGraphY = dyScreen / startZoom;

      setCustomPositions((prev) => {
        const next = { ...prev };
        movingIds.forEach((id) => {
          const init = initialPositions[id];
          if (init) {
            next[id] = {
              x: init.x + deltaGraphX,
              y: init.y + deltaGraphY,
            };
          }
        });
        return next;
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraggingNodeId(null);
      setDraggingClusterIds(new Set());
      if (!didMove) {
        setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.4, prev + delta), 2.5));
  };

  const handleResetPositions = () => {
    setCustomPositions({});
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
    setCustomPositions({});
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
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
        return 'url(#gradSlate)';
      default:
        return '#64748B';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Knowledge graph" description="Explore connections between documents, clauses, findings, and citations." />

      {/* Executive Metric Cards */}
      {data?.stats && (
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
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">{filteredEdges.length} connected edges</span>
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
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
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 max-w-[260px] min-w-0 shrink-0 border ${
                    isSelected
                      ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title={`${d.title} (${d.file_type.toUpperCase()})`}
                >
                  <span className="truncate min-w-0 block flex-1 text-left">{d.title}</span>
                  <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    ({d.file_type.toUpperCase()})
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Control Toolbar */}
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
            >
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Citations
            </button>
          </div>

          {/* Search in Graph & Canvas Controls */}
          <div className="flex items-center gap-2">
            {Object.keys(customPositions).length > 0 && (
              <button
                type="button"
                onClick={handleResetPositions}
                className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 font-medium bg-white shadow-xs"
                title="Reset moved dots back to automatic radial layout"
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
                className="text-xs pl-8 pr-2.5 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 w-40 bg-white"
              />
            </div>

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
          </div>
        </div>
      </Card>

      {/* Main Canvas + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* SVG Network Visualizer */}
        <div className="lg:col-span-3 border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs relative h-[460px] sm:h-[540px] lg:h-[640px] select-none">
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
                Upload documents in the Document Library to index provisions, map citations, and visualize cross-clause relationships in 2D space.
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
                <span className="font-medium text-slate-700">Drag any dot to reposition</span>
                <span>•</span>
                <span>Drag background to pan</span>
                {Object.keys(customPositions).length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-slate-900 font-semibold">
                      {Object.keys(customPositions).length} dot{Object.keys(customPositions).length > 1 ? 's' : ''} moved
                    </span>
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
                  {/* Subtle Dot Grid */}
                  <pattern id="graphGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#E2E8F0" />
                  </pattern>

                  {/* Node Color Gradients */}
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

                {/* Background Canvas */}
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
                    const isInActiveDraggedCluster = draggingClusterIds.has(node.id) && !isBeingDragged;

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
                        {/* Active Drag Halo Ring (Direct Grabbed Dot) */}
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

                        {/* Co-moving Cluster Ring (Sibling dots moving together) */}
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

                        {/* Selection / Hover Ring */}
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

                        {/* Main Node Circle */}
                        <circle
                          r={nodeRadius}
                          fill={fill}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          className="shadow-sm"
                        />

                        {/* Inner Indicator Point */}
                        <circle r={2.5} fill="#FFFFFF" />

                        {/* Node Label Text */}
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
                          {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
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
            <div className="font-semibold text-slate-900 uppercase tracking-wider text-[9px]">Topology Legend</div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                <span className="text-slate-600">Document</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span className="text-slate-600">Topic</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                <span className="text-slate-600">Contradiction</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
                <span className="text-slate-600">Citation</span>
              </span>
            </div>
          </div>

          {/* Canvas Navigation Hint */}
          <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-[10px] text-slate-500 px-2.5 py-1 rounded-md pointer-events-none shadow-xs">
            <span>Drag to pan</span>
            <span>•</span>
            <span>Scroll to zoom</span>
            <span>•</span>
            <span>Click node to inspect</span>
          </div>
        </div>

        {/* Selected Node Inspector Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 bg-white shadow-subtle">
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
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
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
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
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
                  Click any node in the graph to inspect its properties, evidence citations, and relationships.
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
