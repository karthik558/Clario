import re
from typing import List
from app.ingestion.parser import PageText

class ChunkData:
    def __init__(
        self,
        chunk_index: int,
        page_number: int,
        start_char: int,
        end_char: int,
        content: str,
        token_count: int
    ):
        self.chunk_index = chunk_index
        self.page_number = page_number
        self.start_char = start_char
        self.end_char = end_char
        self.content = content
        self.token_count = token_count

class SemanticChunker:
    def __init__(self, target_chunk_size: int = 700, chunk_overlap: int = 150):
        self.target_chunk_size = target_chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_pages(self, pages: List[PageText]) -> List[ChunkData]:
        chunks: List[ChunkData] = []
        global_chunk_idx = 0
        running_char_offset = 0

        for page in pages:
            text = page.text.strip()
            if not text:
                continue

            # Split into paragraphs or sentences
            paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
            if not paragraphs:
                paragraphs = [text]

            current_chunk = ""
            page_start_offset = running_char_offset

            for para in paragraphs:
                if len(current_chunk) + len(para) + 1 <= self.target_chunk_size:
                    if current_chunk:
                        current_chunk += "\n\n" + para
                    else:
                        current_chunk = para
                else:
                    # If current_chunk already has content, emit it
                    if current_chunk:
                        words = current_chunk.split()
                        token_count = len(words)
                        end_offset = running_char_offset + len(current_chunk)
                        chunks.append(
                            ChunkData(
                                chunk_index=global_chunk_idx,
                                page_number=page.page_number,
                                start_char=running_char_offset,
                                end_char=end_offset,
                                content=current_chunk,
                                token_count=token_count
                            )
                        )
                        global_chunk_idx += 1
                        
                        # Apply overlap by taking trailing part
                        if len(current_chunk) > self.chunk_overlap:
                            overlap_text = current_chunk[-self.chunk_overlap:]
                            current_chunk = overlap_text + "\n\n" + para
                        else:
                            current_chunk = para
                        running_char_offset = end_offset
                    else:
                        # Paragraph itself is larger than target_chunk_size, break by sentence or length
                        sentences = re.split(r'(?<=[.!?])\s+', para)
                        temp_chunk = ""
                        for sent in sentences:
                            if len(temp_chunk) + len(sent) + 1 <= self.target_chunk_size:
                                temp_chunk = (temp_chunk + " " + sent).strip()
                            else:
                                if temp_chunk:
                                    end_offset = running_char_offset + len(temp_chunk)
                                    chunks.append(
                                        ChunkData(
                                            chunk_index=global_chunk_idx,
                                            page_number=page.page_number,
                                            start_char=running_char_offset,
                                            end_char=end_offset,
                                            content=temp_chunk,
                                            token_count=len(temp_chunk.split())
                                        )
                                    )
                                    global_chunk_idx += 1
                                    running_char_offset = end_offset
                                temp_chunk = sent
                        current_chunk = temp_chunk

            # Emit final leftover chunk for the page
            if current_chunk.strip():
                end_offset = running_char_offset + len(current_chunk)
                chunks.append(
                    ChunkData(
                        chunk_index=global_chunk_idx,
                        page_number=page.page_number,
                        start_char=running_char_offset,
                        end_char=end_offset,
                        content=current_chunk.strip(),
                        token_count=len(current_chunk.split())
                    )
                )
                global_chunk_idx += 1
                running_char_offset = end_offset

        return chunks
