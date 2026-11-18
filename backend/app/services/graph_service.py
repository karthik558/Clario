from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.entities import Document, DocumentChunk, Finding, Report
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
                summary="No documents in workspace. Upload documents to generate the visual knowledge network.",
                total_nodes=0,
                total_edges=0
            )

        active_doc_ids = {d.id for d in docs}
        finding_query = db.query(Finding).filter(
            Finding.doc_a_id.in_(active_doc_ids)
        )
        if document_ids:
            finding_query = finding_query.filter(
                or_(Finding.doc_a_id.in_(document_ids), Finding.doc_b_id.in_(document_ids))
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

        # 2. Key Policy & Obligation Topic Nodes (Teal)
        topics = [
            ("topic_retention", "Data Retention & Storage", "30-day baseline vs Zero Data Retention (ZDR) default"),
            ("topic_liability", "Liability & Financial Ceilings", "$100 USD nominal vs $250,000 USD expanded ceiling"),
            ("topic_breach", "Security Incident & Breach Notice", "30 days vs 72h preliminary alert & 60-day forensic report"),
            ("topic_copyright", "Copyright Shield & IP Defense", "Customer unilateral indemnity vs Copyright Shield defense"),
            ("topic_hipaa", "Healthcare & HIPAA Eligibility", "BAAs prohibited vs BAAs available for dedicated health endpoints"),
            ("topic_residency", "Sovereign Compute & Data Boundary", "US data centers only vs Sovereign EU data boundary"),
            ("topic_security", "Hardware Enclaves & Memory Sanitization", "Stateless GPU wipe vs Confidential Computing enclaves"),
            ("topic_safety", "Frontier Safety & Red-Teaming", "Baseline filters vs Frontier Safety Framework with severe risk gates")
        ]

        for tid, tlabel, tdesc in topics:
            if tid not in node_ids:
                node_ids.add(tid)
                nodes.append(GraphNode(
                    id=tid,
                    label=tlabel,
                    type="topic",
                    size=18.0,
                    color="#477E88", # Muted Teal
                    metadata={"description": tdesc}
                ))

            # Connect each document to governing topics
            for d in docs:
                edge_id = f"edge_{d.id}_{tid}"
                edges.append(GraphEdge(
                    id=edge_id,
                    source=f"doc_{d.id}",
                    target=tid,
                    label="Governs",
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
                        "description": f.description,
                        "doc_a_title": f.doc_a_title,
                        "doc_b_title": f.doc_b_title
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

        # 4. Sample Key Chunk Nodes (Sage)
        for d in docs:
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == d.id).limit(3).all()
            for c in chunks:
                cid = f"chunk_{c.id}"
                if cid not in node_ids:
                    node_ids.add(cid)
                    nodes.append(GraphNode(
                        id=cid,
                        label=f"{d.title} (p.{c.page_number})",
                        type="chunk",
                        size=9.0,
                        color="#94A3B8",
                        metadata={
                            "chunk_id": c.id,
                            "page": c.page_number,
                            "snippet": c.content[:100]
                        }
                    ))
                    edges.append(GraphEdge(
                        id=f"edge_chunk_{c.id}",
                        source=f"doc_{d.id}",
                        target=cid,
                        label="Contains",
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
                "total_topics": len(topics),
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }
        )
