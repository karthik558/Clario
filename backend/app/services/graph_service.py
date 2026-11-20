import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.entities import Document, DocumentChunk, Finding
from app.schemas.dtos import GraphNode, GraphEdge, GraphDataResponse

class GraphService:
    @staticmethod
    def build_workspace_graph(db: Session, document_ids: Optional[List[str]] = None) -> GraphDataResponse:
        doc_query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            doc_query = doc_query.filter(Document.id.in_(document_ids))
        docs = doc_query.all()

        if not docs:
            return GraphDataResponse(
                nodes=[],
                edges=[],
                stats={
                    "total_documents": 0,
                    "total_findings": 0,
                    "total_topics": 0,
                    "total_nodes": 0,
                    "total_edges": 0
                }
            )

        active_doc_ids = {d.id for d in docs}
        if document_ids:
            finding_query = db.query(Finding).filter(
                or_(Finding.doc_a_id.in_(document_ids), Finding.doc_b_id.in_(document_ids))
            )
        else:
            finding_query = db.query(Finding).filter(
                or_(Finding.doc_a_id.in_(active_doc_ids), Finding.doc_b_id.in_(active_doc_ids))
            )
        findings = finding_query.all()

        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_ids = set()

        # 1. Document Nodes (Navy)
        for d in docs:
            nid = f"doc_{d.id}"
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append(GraphNode(
                    id=nid,
                    label=d.title,
                    type="document",
                    size=26.0,
                    color="#14263D", # Midnight Navy
                    metadata={
                        "document_id": d.id,
                        "filename": d.filename,
                        "pages": d.page_count,
                        "collection": d.collection,
                        "chunks": d.chunk_count
                    }
                ))

        # 2. Extract REAL Topic / Section Nodes from Documents
        topic_count = 0
        for d in docs:
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == d.id).order_by(DocumentChunk.chunk_index).all()
            
            # Extract sheets or headings from actual chunk text
            detected_topics = []
            for c in chunks:
                for line in c.content.splitlines():
                    line = line.strip()
                    # Spreadsheet sheet headers
                    if line.startswith('### Sheet:'):
                        clean_s = line.replace('### Sheet:', '').replace('(continued)', '').strip()
                        if clean_s and clean_s not in [t[0] for t in detected_topics]:
                            desc = f"Workbook sheet in {d.title}"
                            detected_topics.append((clean_s, f"Sheet: {clean_s}", desc, c))
                    # Markdown section headers
                    elif line.startswith('# ') or line.startswith('## '):
                        clean_h = re.sub(r'^#+\s*', '', line).strip()
                        if len(clean_h) >= 3 and len(clean_h) < 60 and not clean_h.startswith('|') and clean_h not in [t[0] for t in detected_topics]:
                            desc = f"Section in {d.title}"
                            detected_topics.append((clean_h, clean_h, desc, c))

            # Fallback if no sheets or headings found
            if not detected_topics:
                detected_topics.append(("core_content", f"{d.title} Provisions", f"Indexed provisions from {d.title}", chunks[0] if chunks else None))

            for raw_key, label, desc, rep_chunk in detected_topics[:6]:
                topic_slug = re.sub(r'[^a-zA-Z0-9_]', '_', raw_key.lower())[:30]
                tid = f"topic_{d.id[:8]}_{topic_slug}"
                if tid not in node_ids:
                    node_ids.add(tid)
                    topic_count += 1
                    nodes.append(GraphNode(
                        id=tid,
                        label=label,
                        type="topic",
                        size=18.0,
                        color="#477E88", # Muted Teal
                        metadata={
                            "document_id": d.id,
                            "document_title": d.title,
                            "description": desc,
                            "topic_name": raw_key
                        }
                    ))

                    # Edge: Document -> governs/contains -> Topic
                    edge_id = f"edge_{d.id}_{tid}"
                    edges.append(GraphEdge(
                        id=edge_id,
                        source=f"doc_{d.id}",
                        target=tid,
                        label="Contains",
                        type="governs",
                        color="#94A3B8",
                        dashed=False,
                        weight=1.0
                    ))

        # 3. Contradiction & Finding Nodes (Crimson Rose / Amber)
        for f in findings:
            fid = f"finding_{f.id}"
            if fid not in node_ids:
                node_ids.add(fid)
                severity_color = "#E11D48" if f.severity in ("critical", "high") else "#F59E0B"
                primary_doc_id = f.doc_a_id if (not document_ids or f.doc_a_id in document_ids) else f.doc_b_id
                nodes.append(GraphNode(
                    id=fid,
                    label=f.title,
                    type="finding",
                    size=15.0,
                    color=severity_color, # Rose / Amber
                    metadata={
                        "finding_id": f.id,
                        "severity": f.severity,
                        "status": f.status,
                        "category": f.category or "Contractual Variance",
                        "description": f.description,
                        "doc_a_id": f.doc_a_id,
                        "doc_a_title": f.doc_a_title,
                        "doc_a_page": f.doc_a_page,
                        "doc_a_quote": f.doc_a_quote,
                        "doc_b_id": f.doc_b_id,
                        "doc_b_title": f.doc_b_title,
                        "doc_b_page": f.doc_b_page,
                        "doc_b_quote": f.doc_b_quote,
                        "document_id": primary_doc_id,
                    }
                ))

                # Edge from finding to Doc A (Red)
                if f.doc_a_id and f"doc_{f.doc_a_id}" in node_ids:
                    edges.append(GraphEdge(
                        id=f"edge_{f.id}_a",
                        source=fid,
                        target=f"doc_{f.doc_a_id}",
                        label="Doc A Clause",
                        type="contradicts",
                        color="#E11D48",
                        dashed=True,
                        weight=2.0
                    ))

                # Edge from finding to Doc B (Red)
                if f.doc_b_id and f"doc_{f.doc_b_id}" in node_ids:
                    edges.append(GraphEdge(
                        id=f"edge_{f.id}_b",
                        source=fid,
                        target=f"doc_{f.doc_b_id}",
                        label="Doc B Clause",
                        type="contradicts",
                        color="#E11D48",
                        dashed=True,
                        weight=2.0
                    ))

                # Edge from finding to matching Topics in Doc A or Doc B
                for n in nodes:
                    if n.type == "topic":
                        t_doc_id = n.metadata.get("document_id")
                        if t_doc_id in (f.doc_a_id, f.doc_b_id):
                            t_label_lower = n.label.lower()
                            f_cat_lower = (f.category or "").lower()
                            f_title_lower = f.title.lower()
                            keywords = ["liability", "retention", "training", "termination", "indemni", "ip", "intellectual", "confidential", "warranty", "audit", "governing", "payment", "data", "provisions"]
                            matches = any(k in t_label_lower and (k in f_cat_lower or k in f_title_lower) for k in keywords)
                            if matches or f_cat_lower in t_label_lower or t_label_lower in f_cat_lower:
                                edges.append(GraphEdge(
                                    id=f"edge_topic_{n.id}_{fid}",
                                    source=n.id,
                                    target=fid,
                                    label="Contradiction",
                                    type="contradicts",
                                    color="#E11D48",
                                    dashed=True,
                                    weight=1.5
                                ))

        # 4. Sample Key Chunk Nodes (Slate)
        for d in docs:
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == d.id).limit(4).all()
            for c in chunks:
                cid = f"chunk_{c.id}"
                if cid not in node_ids:
                    node_ids.add(cid)
                    clean_snippet = c.content.strip().splitlines()[0] if c.content.strip().splitlines() else ""
                    clean_snippet = re.sub(r'^[#| \-:]+', '', clean_snippet)[:80]
                    nodes.append(GraphNode(
                        id=cid,
                        label=f"{d.title} (p.{c.page_number})",
                        type="chunk",
                        size=9.0,
                        color="#94A3B8",
                        metadata={
                            "chunk_id": c.id,
                            "document_id": d.id,
                            "document_title": d.title,
                            "page": c.page_number,
                            "snippet": clean_snippet or c.content[:100]
                        }
                    ))
                    edges.append(GraphEdge(
                        id=f"edge_chunk_{c.id}",
                        source=f"doc_{d.id}",
                        target=cid,
                        label="Passage",
                        type="contains",
                        color="#CBD5E1",
                        dashed=False,
                        weight=0.5
                    ))

        return GraphDataResponse(
            nodes=nodes,
            edges=edges,
            stats={
                "total_documents": len(docs),
                "total_findings": len(findings),
                "total_topics": topic_count,
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        )
