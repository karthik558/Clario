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
  Move
} from 'lucide-react';
import { api } from '../services/api';
import { GraphDataResponse, GraphNode, DocumentItem } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { DocumentViewerModal } from '../components/documents/DocumentViewerModal';
import { ClauseNegotiatorModal } from '../components/negotiate/ClauseNegotiatorModal';

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  parentDocId?: string;
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

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;

  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  // Document constellation offsets & child fine-tuning offsets
  // When a document moves, all its satellite nodes move synchronously with it
  const [docOffsets, setDocOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [childOffsets, setChildOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const fetchGraph = async (docIds?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getKnowledgeGraph(docIds && docIds.length > 0 ? docIds : undefined);
      setData(res);
      // If there are 6+ documents, collapse citations by default to keep constellations readable
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
    setDocOffsets({});
    setChildOffsets({});
    fetchGraph(next);
  };

  const selectAllDocuments = () => {
    setSelectedDocIds([]);
    setSelectedNodeId(null);
    setDocOffsets({});
    setChildOffsets({});
    fetchGraph([]);
  };

  // Filter active nodes based on layer toggles & search
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

  // Layout Engine:
  // Each document has a constellation center: (defaultX + docOffset.x, defaultY + docOffset.y).
  // All satellite items (topics, findings, citations) calculate coordinates directly from their parent document center.
  // When a document is moved, ALL its satellite items move simultaneously.
  const layoutNodes = useMemo<LayoutNode[]>(() => {
    if (!filteredNodes.length) return [];
    const centerX = 500;
    const centerY = 350;

    const docs = filteredNodes.filter((n) => n.type === 'document');
    const topics = filteredNodes.filter((n) => n.type === 'topic');
    const findings = filteredNodes.filter((n) => n.type === 'finding');
    const chunks = filteredNodes.filter((n) => n.type === 'chunk');

    const nDocs = docs.length;
    const docCenters: Record<string, { x: number; y: number }> = {};

    // 1. Calculate document constellation center positions
    if (nDocs <= 1) {
      if (docs[0]) {
        const dId = docs[0].id.replace(/^doc_/, '');
        const off = docOffsets[dId] || { x: 0, y: 0 };
        docCenters[docs[0].id] = { x: centerX + off.x, y: centerY + off.y };
      }
    } else if (nDocs === 2) {
      const d0Id = docs[0].id.replace(/^doc_/, '');
      const d1Id = docs[1].id.replace(/^doc_/, '');
      const off0 = docOffsets[d0Id] || { x: 0, y: 0 };
      const off1 = docOffsets[d1Id] || { x: 0, y: 0 };
      docCenters[docs[0].id] = { x: centerX - 240 + off0.x, y: centerY + off0.y };
      docCenters[docs[1].id] = { x: centerX + 240 + off1.x, y: centerY + off1.y };
    } else {
      // Ample spacious elliptical distribution for multi-document view
      const orbitRadiusX = Math.max(260, 34 * nDocs);
      const orbitRadiusY = Math.max(200, 26 * nDocs);
      docs.forEach((doc, idx) => {
        const dId = doc.id.replace(/^doc_/, '');
        const off = docOffsets[dId] || { x: 0, y: 0 };
        const angle = (idx / nDocs) * 2 * Math.PI - Math.PI / 2;
        docCenters[doc.id] = {
          x: Math.round(centerX + orbitRadiusX * Math.cos(angle) + off.x),
          y: Math.round(centerY + orbitRadiusY * Math.sin(angle) + off.y),
        };
      });
    }

    const result: LayoutNode[] = [];

    // 2. Place document nodes
    docs.forEach((doc) => {
      const center = docCenters[doc.id] || { x: centerX, y: centerY };
      result.push({
        ...doc,
        x: center.x,
        y: center.y,
        parentDocId: doc.id,
      });
    });

    // Helper to identify document parent for any node
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

    // Group child nodes by document parent
    const docTopics: Record<string, GraphNode[]> = {};
    const docChunks: Record<string, GraphNode[]> = {};
    const docFindings: Record<string, GraphNode[]> = {};
    const bilateralFindings: GraphNode[] = [];
    const orphanNodes: GraphNode[] = [];

    topics.forEach((t) => {
      const pId = getDocParentId(t);
      if (pId && docCenters[pId]) {
        if (!docTopics[pId]) docTopics[pId] = [];
        docTopics[pId].push(t);
      } else {
        orphanNodes.push(t);
      }
    });

    chunks.forEach((c) => {
      const pId = getDocParentId(c);
      if (pId && docCenters[pId]) {
        if (!docChunks[pId]) docChunks[pId] = [];
        docChunks[pId].push(c);
      } else {
        orphanNodes.push(c);
      }
    });

    findings.forEach((f) => {
      const docAId = f.metadata?.doc_a_id ? `doc_${f.metadata.doc_a_id}` : null;
      const docBId = f.metadata?.doc_b_id ? `doc_${f.metadata.doc_b_id}` : null;
      if (docAId && docBId && docCenters[docAId] && docCenters[docBId] && docAId !== docBId) {
        bilateralFindings.push(f);
      } else {
        const pId =
          (docAId && docCenters[docAId] ? docAId : null) ||
          (docBId && docCenters[docBId] ? docBId : null) ||
          getDocParentId(f);
        if (pId && docCenters[pId]) {
          if (!docFindings[pId]) docFindings[pId] = [];
          docFindings[pId].push(f);
        } else {
          bilateralFindings.push(f);
        }
      }
    });

    // 3. Orbit satellite provisions around their document centers
    docs.forEach((doc) => {
      const center = docCenters[doc.id];
      if (!center) return;

      const dTopics = docTopics[doc.id] || [];
      dTopics.forEach((t, i) => {
        const angle = (i / Math.max(dTopics.length, 1)) * 2 * Math.PI;
        const radius = 68;
        const childOff = childOffsets[t.id] || { x: 0, y: 0 };
        result.push({
          ...t,
          x: Math.round(center.x + radius * Math.cos(angle) + childOff.x),
          y: Math.round(center.y + radius * Math.sin(angle) + childOff.y),
          parentDocId: doc.id,
        });
      });

      const dFindings = docFindings[doc.id] || [];
      dFindings.forEach((f, i) => {
        const angle = (i / Math.max(dFindings.length, 1)) * 2 * Math.PI + Math.PI / 4;
        const radius = 96;
        const childOff = childOffsets[f.id] || { x: 0, y: 0 };
        result.push({
          ...f,
          x: Math.round(center.x + radius * Math.cos(angle) + childOff.x),
          y: Math.round(center.y + radius * Math.sin(angle) + childOff.y),
          parentDocId: doc.id,
        });
      });

      const dChunks = docChunks[doc.id] || [];
      dChunks.forEach((c, i) => {
        const angle = (i / Math.max(dChunks.length, 1)) * 2 * Math.PI + Math.PI / 6;
        const radius = 124;
        const childOff = childOffsets[c.id] || { x: 0, y: 0 };
        result.push({
          ...c,
          x: Math.round(center.x + radius * Math.cos(angle) + childOff.x),
          y: Math.round(center.y + radius * Math.sin(angle) + childOff.y),
          parentDocId: doc.id,
        });
      });
    });

    // 4. Bilateral findings stretch midway between the connected document constellations
    bilateralFindings.forEach((f, i) => {
      const docAId = f.metadata?.doc_a_id ? `doc_${f.metadata.doc_a_id}` : null;
      const docBId = f.metadata?.doc_b_id ? `doc_${f.metadata.doc_b_id}` : null;
      const childOff = childOffsets[f.id] || { x: 0, y: 0 };

      if (docAId && docBId && docCenters[docAId] && docCenters[docBId]) {
        const cA = docCenters[docAId];
        const cB = docCenters[docBId];
        const midX = (cA.x + cB.x) / 2;
        const midY = (cA.y + cB.y) / 2;
        const spread = ((i % 3) - 1) * 20;
        result.push({
          ...f,
          x: Math.round(midX * 0.8 + centerX * 0.2 + spread + childOff.x),
          y: Math.round(midY * 0.8 + centerY * 0.2 + spread + childOff.y),
        });
      } else {
        const angle = (i / Math.max(bilateralFindings.length, 1)) * 2 * Math.PI;
        const radius = 75;
        result.push({
          ...f,
          x: Math.round(centerX + radius * Math.cos(angle) + childOff.x),
          y: Math.round(centerY + radius * Math.sin(angle) + childOff.y),
        });
      }
    });

    // 5. Unattached nodes
    orphanNodes.forEach((node, i) => {
      const angle = (i / Math.max(orphanNodes.length, 1)) * 2 * Math.PI;
      const radius = 55;
      const childOff = childOffsets[node.id] || { x: 0, y: 0 };
      result.push({
        ...node,
        x: Math.round(centerX + radius * Math.cos(angle) + childOff.x),
        y: Math.round(centerY + radius * Math.sin(angle) + childOff.y),
      });
    });

    return result;
  }, [filteredNodes, filteredEdges, docOffsets, childOffsets]);

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

  const connectedFindings = useMemo(() => {
    if (!selectedNodeId || !data) return [];
    const directOtherIds = new Set<string>();
    filteredEdges.forEach((e) => {
      if (e.source === selectedNodeId) directOtherIds.add(e.target);
      if (e.target === selectedNodeId) directOtherIds.add(e.source);
    });
    return data.nodes.filter(
      (n) => n.type === 'finding' && (directOtherIds.has(n.id) || n.id === selectedNodeId)
    );
  }, [selectedNodeId, filteredEdges, data]);

  // Canvas pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingCanvas(true);
    let didMove = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialPanX = panRef.current.x;
    const initialPanY = panRef.current.y;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMove = true;
      }
      setPan({
        x: initialPanX + dx,
        y: initialPanY + dy,
      });
    };

    const onMouseUp = () => {
      setIsDraggingCanvas(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!didMove) {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.4), 2.2);
      return Math.round(next * 100) / 100;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
  };

  const handleResetLayout = () => {
    setDocOffsets({});
    setChildOffsets({});
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
    setSelectedNodeId(null);
  };

  // Node Drag Handler:
  // - Grabbing a Document node moves its entire constellation together via requestAnimationFrame (0 lag)
  // - Grabbing a child node (topic, finding, citation) moves just that individual dot for fine-tuning
  const handleNodeMouseDown = (e: React.MouseEvent, node: LayoutNode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const isDoc = node.type === 'document';
    const docId = isDoc ? node.id.replace(/^doc_/, '') : null;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const currentZoom = zoomRef.current;

    const initialDocOffset = docId ? docOffsets[docId] || { x: 0, y: 0 } : null;
    const initialChildOffset = !isDoc ? childOffsets[node.id] || { x: 0, y: 0 } : null;

    setDraggingNodeId(node.id);
    let didMove = false;
    let rafId: number | null = null;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dxScreen = moveEvt.clientX - startClientX;
      const dyScreen = moveEvt.clientY - startClientY;
      if (Math.abs(dxScreen) > 3 || Math.abs(dyScreen) > 3) {
        didMove = true;
      }

      const dxGraph = dxScreen / currentZoom;
      const dyGraph = dyScreen / currentZoom;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (isDoc && docId && initialDocOffset) {
          setDocOffsets((prev) => ({
            ...prev,
            [docId]: {
              x: Math.round(initialDocOffset.x + dxGraph),
              y: Math.round(initialDocOffset.y + dyGraph),
            },
          }));
        } else if (!isDoc && initialChildOffset) {
          setChildOffsets((prev) => ({
            ...prev,
            [node.id]: {
              x: Math.round(initialChildOffset.x + dxGraph),
              y: Math.round(initialChildOffset.y + dyGraph),
            },
          }));
        }
      });
    };

    const onMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      setDraggingNodeId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!didMove) {
        setSelectedNodeId(node.id);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const totalMovedCount = Object.keys(docOffsets).length + Object.keys(childOffsets).length;

  return (
    <div className="space-y-6">
      {/* Page Header matching Overview and Documents */}
      <PageHeader
        title="Knowledge graph"
        description="Explore cross-document provisions, semantic topic clusters, and detected contractual contradictions."
      />

      {/* Metric Stat Ribbon matching Findings and Overview */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md bg-white">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">
                Indexed Documents
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_documents}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Active Corpus</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md bg-white">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">
                Discovered Topics
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_topics}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Provisions & Sections</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md bg-white">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">
                Flagged Contradictions
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-clario-navy font-mono">
              {data.stats.total_findings}
            </span>
            <span className="text-[10px] text-clario-text-secondary font-medium mt-1">Risk Differentials</span>
          </Card>

          <Card className="p-4 flex flex-col justify-between hover:border-clario-navy/20 transition-all shadow-subtle rounded-md bg-white">
            <div className="flex items-center justify-between text-clario-text-secondary mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider">
                Active Nodes
              </span>
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

      {/* Document Scope Selector Bar */}
      {documents.length > 0 && (
        <Card className="p-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label htmlFor="graph-doc-scope" className="text-slate-700 font-semibold flex items-center gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Document Scope:</span>
            </label>
            <Select
              id="graph-doc-scope"
              value={selectedDocIds[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDocIds(val ? [val] : []);
                setSelectedNodeId(null);
              }}
              className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 min-w-[240px] max-w-md"
            >
              <option value="">All Workspace Documents ({documents.length})</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title.replace(/_/g, ' ')} ({d.file_type.toUpperCase()})
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      {/* Control Toolbar matching Clario Design Standards */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Node Filter Toggles */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Layers:
            </span>

            <button
              type="button"
              onClick={() => toggleType('document')}
              className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.document
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-900 border border-white" />
              <span>Documents</span>
            </button>

            <button
              type="button"
              onClick={() => toggleType('topic')}
              className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.topic
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-600 border border-white" />
              <span>Topics</span>
            </button>

            <button
              type="button"
              onClick={() => toggleType('finding')}
              className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.finding
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-700 border border-white" />
              <span>Contradictions</span>
            </button>

            <button
              type="button"
              onClick={() => toggleType('chunk')}
              className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                visibleTypes.chunk
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle citation excerpts (hidden by default in multi-document view)"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400 border border-white" />
              <span>Citations</span>
            </button>
          </div>

          {/* Search, Reset Layout & Canvas Zoom Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {totalMovedCount > 0 && (
              <button
                type="button"
                onClick={handleResetLayout}
                className="text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 font-medium bg-white shadow-xs"
                title="Reset moved constellations back to default positions"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Layout ({totalMovedCount})</span>
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find node or topic..."
                className="text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900 w-36 sm:w-44 bg-white text-slate-900 shadow-xs"
              />
            </div>

            <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => handleZoom(0.15)}
                className="p-1.5 text-slate-600 hover:text-slate-900 border-r border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-0.15)}
                className="p-1.5 text-slate-600 hover:text-slate-900 border-r border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none"
                title="Center View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Visualizer + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Constellation Canvas */}
        <div className="lg:col-span-3 border border-slate-200 rounded-md bg-white overflow-hidden shadow-xs relative h-[560px] sm:h-[640px] lg:h-[720px] select-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              <p className="text-xs">Constructing semantic relationship graph...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-rose-600 p-6">
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
              {/* Interaction Guide Chip */}
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-md px-3 py-1.5 text-[11px] text-slate-600 shadow-xs pointer-events-none flex items-center gap-2 z-10">
                <Move className="w-3.5 h-3.5 text-slate-900" />
                <span className="font-semibold text-slate-900">Drag Document Hub</span>
                <span>to move entire constellation</span>
                <span>•</span>
                <span>Drag child dot to fine-tune</span>
                <span>•</span>
                <span>Drag background to pan</span>
              </div>

              <svg
                ref={svgRef}
                className={`w-full h-full ${
                  draggingNodeId ? 'cursor-grabbing' : isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'
                }`}
                onMouseDown={handleCanvasMouseDown}
              >
                <defs>
                  <pattern id="graphGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#E2E8F0" />
                  </pattern>
                </defs>

                {/* Subtle Dot Grid Background */}
                <rect width="100%" height="100%" fill="url(#graphGrid)" />

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Constellation Boundary Rings around Document Hubs */}
                  {layoutNodes
                    .filter((n) => n.type === 'document')
                    .map((docNode) => {
                      const isHovered = hoveredNodeId === docNode.id;
                      const isDragged = draggingNodeId === docNode.id;
                      return (
                        <circle
                          key={`boundary_${docNode.id}`}
                          cx={docNode.x}
                          cy={docNode.y}
                          r={140}
                          fill={isDragged ? '#F1F5F9' : '#F8FAFC'}
                          fillOpacity={isDragged ? 0.5 : isHovered ? 0.4 : 0.2}
                          stroke={isDragged ? '#0F172A' : isHovered ? '#64748B' : '#E2E8F0'}
                          strokeWidth={isDragged ? 1.5 : 1}
                          strokeDasharray="4,4"
                          className="transition-all duration-150 pointer-events-none"
                        />
                      );
                    })}

                  {/* Edges */}
                  {filteredEdges.map((edge) => {
                    const source = layoutNodeMap.get(edge.source);
                    const target = layoutNodeMap.get(edge.target);
                    if (!source || !target) return null;

                    const isHighlighted =
                      selectedNodeId &&
                      (edge.source === selectedNodeId || edge.target === selectedNodeId);
                    const isDimmed = selectedNodeId && !isHighlighted;
                    const isContradiction = edge.type === 'contradicts';

                    return (
                      <line
                        key={edge.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={
                          isHighlighted
                            ? '#0F172A'
                            : isContradiction
                            ? '#DC2626'
                            : '#CBD5E1'
                        }
                        strokeWidth={isHighlighted ? 2.5 : isContradiction ? 1.5 : 1.2}
                        strokeDasharray={isContradiction ? '4,4' : undefined}
                        opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.8}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {layoutNodes.map((node) => {
                    const isSelected = node.id === selectedNodeId;
                    const isConnected = connectedNodeIds.has(node.id);
                    const isDimmed = selectedNodeId && !isSelected && !isConnected;
                    const isHovered = node.id === hoveredNodeId;
                    const isBeingDragged = draggingNodeId === node.id;
                    const isDoc = node.type === 'document';

                    // Node styling matching Clario design system
                    const nodeRadius =
                      node.type === 'document' ? 20 : node.type === 'finding' ? 13 : node.type === 'topic' ? 12 : 9;

                    const nodeFill =
                      node.type === 'document'
                        ? '#0F172A' // Clario Navy
                        : node.type === 'finding'
                        ? '#991B1B' // Deep Rose
                        : node.type === 'topic'
                        ? '#334155' // Slate-700
                        : '#64748B'; // Slate-500

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
                        opacity={isDimmed ? 0.2 : 1}
                      >
                        {/* Drag Halo */}
                        {isBeingDragged && (
                          <circle
                            r={nodeRadius + 8}
                            fill="none"
                            stroke="#0F172A"
                            strokeWidth={1.5}
                            strokeDasharray="3,3"
                            opacity={0.8}
                          />
                        )}

                        {/* Hover / Selection Halo */}
                        {(isSelected || isHovered) && !isBeingDragged && (
                          <circle
                            r={nodeRadius + 6}
                            fill="none"
                            stroke={node.type === 'finding' ? '#DC2626' : '#0F172A'}
                            strokeWidth={1.5}
                            strokeDasharray={isSelected ? undefined : '3,3'}
                            opacity={0.85}
                          />
                        )}

                        {/* Circle Body */}
                        <circle
                          r={nodeRadius}
                          fill={nodeFill}
                          stroke="#FFFFFF"
                          strokeWidth={isDoc ? 2 : 1.5}
                          className="shadow-xs"
                        />

                        {/* Center Inner Dot for Documents */}
                        {isDoc && <circle r={3} fill="#FFFFFF" />}

                        {/* Label */}
                        <text
                          y={nodeRadius + 14}
                          textAnchor="middle"
                          fontSize={isDoc ? '11px' : '9.5px'}
                          fontWeight={isDoc || isSelected ? '600' : '500'}
                          fill="#0F172A"
                          className="pointer-events-none select-none"
                          style={{
                            textShadow:
                              '0 1px 2px rgba(255,255,255,0.95), 0 -1px 2px rgba(255,255,255,0.95)',
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

          {/* Clean Legend Overlay matching Clario Palette */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-md px-3 py-2 text-[10px] space-y-1 shadow-xs pointer-events-none text-slate-700">
            <div className="font-semibold text-slate-900 uppercase tracking-wider text-[9px]">
              Topology Legend
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
                <span className="text-slate-600">Document Hub (Drag to move system)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                <span className="text-slate-600">Topic</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-700 inline-block" />
                <span className="text-slate-600">Contradiction</span>
              </span>
              {visibleTypes.chunk && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                  <span className="text-slate-600">Citation</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Node Inspector Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 bg-white shadow-subtle border border-slate-200 rounded-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-900">Node Inspector</span>
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
                        ? 'sage'
                        : selectedNode.type === 'finding'
                        ? 'red'
                        : 'gray'
                    }
                  >
                    {selectedNode.type.toUpperCase()}
                  </Badge>
                  <h4 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                    {selectedNode.label}
                  </h4>
                </div>

                {/* Node Specific Metadata */}
                {selectedNode.metadata && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 space-y-1.5 text-xs text-slate-600">
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

                {/* Associated Contradictions List for Document or Topic */}
                {connectedFindings.length > 0 && selectedNode.type !== 'finding' && (
                  <div className="p-2.5 rounded-md border border-rose-200 bg-rose-50/60 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Associated Contradictions ({connectedFindings.length})
                    </span>
                    <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
                      {connectedFindings.map((cf) => (
                        <button
                          key={cf.id}
                          type="button"
                          onClick={() => setSelectedNodeId(cf.id)}
                          className="w-full text-left p-2 rounded-md bg-white hover:bg-rose-100/70 border border-rose-200/80 transition-colors flex items-center justify-between text-xs group shadow-xs"
                        >
                          <div className="truncate mr-2 min-w-0">
                            <span className="font-semibold text-rose-950 truncate block text-[11px]">
                              {cf.label}
                            </span>
                            <span className="text-[10px] text-rose-700 truncate block">
                              {cf.metadata?.description || cf.metadata?.category || 'Contradiction flagged'}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-700 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
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
                      const isContradiction = edge.type === 'contradicts' || otherNode.type === 'finding';

                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => setSelectedNodeId(otherId)}
                          className={`w-full text-left p-2 rounded-md border transition-colors flex items-center justify-between text-xs ${
                            isContradiction
                              ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/60'
                              : 'border-slate-100 hover:border-slate-300 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span
                              className={`text-[10px] uppercase font-semibold block ${
                                isContradiction ? 'text-rose-600' : 'text-slate-400'
                              }`}
                            >
                              {edge.type}
                            </span>
                            <span
                              className={`font-medium truncate block ${
                                isContradiction ? 'text-rose-950 font-semibold' : 'text-slate-800'
                              }`}
                            >
                              {otherNode.label}
                            </span>
                          </div>
                          <ArrowRight
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isContradiction ? 'text-rose-500' : 'text-slate-400'
                            }`}
                          />
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
                  Click any node in the constellation to inspect its properties, evidence citations, and relationships.
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
