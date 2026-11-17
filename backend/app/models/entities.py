import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # pdf, docx, txt, md
    file_size = Column(Integer, nullable=False)     # bytes
    storage_path = Column(String(500), nullable=False)
    page_count = Column(Integer, default=1)
    word_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    status = Column(String(30), default="QUEUED")   # QUEUED, PROCESSING, READY, ERROR
    error_message = Column(Text, nullable=True)
    tags_json = Column(Text, default="[]")          # JSON array of tags
    collection = Column(String(100), default="General")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan", order_by="DocumentChunk.chunk_index")
    jobs = relationship("IngestionJob", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, default=1)
    start_char = Column(Integer, default=0)
    end_char = Column(Integer, default=0)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    embedding_json = Column(Text, nullable=True)   # Stored dense vector as JSON array of floats
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING, EXTRACTING, CHUNKING, EMBEDDING, COMPLETED, FAILED
    progress_percent = Column(Integer, default=0)
    current_stage = Column(String(100), default="Initialized")
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="jobs")


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    query_text = Column(Text, nullable=False)
    mode = Column(String(30), nullable=False)  # bm25, vector, hybrid
    top_k = Column(Integer, default=5)
    latency_ms = Column(Float, default=0.0)
    result_count = Column(Integer, default=0)
    results_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    doc_a_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    doc_b_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    similarity_score = Column(Float, default=0.0)
    added_count = Column(Integer, default=0)
    removed_count = Column(Integer, default=0)
    changed_count = Column(Integer, default=0)
    diff_data_json = Column(Text, default="{}")
    contradiction_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(50), nullable=False) # possible_contradiction, agreement, missing_coverage, outdated_statement, changed_obligation, needs_human_review
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="medium") # low, medium, high
    status = Column(String(30), default="open")     # open, under_review, confirmed, dismissed, resolved
    doc_a_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    doc_a_title = Column(String(255), nullable=True)
    doc_a_page = Column(Integer, nullable=True)
    doc_a_quote = Column(Text, nullable=True)
    doc_b_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    doc_b_title = Column(String(255), nullable=True)
    doc_b_page = Column(Integer, nullable=True)
    doc_b_quote = Column(Text, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False) # summary, comparative, search_benchmark, contradictions, research_dossier
    executive_summary = Column(Text, nullable=False)
    content_json = Column(Text, default="{}")
    document_ids_json = Column(Text, default="[]")
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AppConfiguration(Base):
    __tablename__ = "app_configuration"

    id = Column(String(30), primary_key=True, default="workspace")
    settings_json = Column(Text, nullable=False, default="{}")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnswerRecord(Base):
    __tablename__ = "answer_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    query = Column(Text, nullable=False)
    document_ids_json = Column(Text, nullable=False, default="[]")
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
