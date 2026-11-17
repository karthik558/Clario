# CloudScale Enterprise Data Retention & Deletion Policy
**Document Identifier:** CS-POL-RET-2023-V1  
**Effective Date:** January 15, 2023  
**Status:** Active (Superseded by 2024 Policy)  
**Governing Jurisdiction:** State of Delaware, United States  

---

### Section 1: Purpose and Operational Scope
CloudScale Inc. provides managed cloud infrastructure and automated analytical processing for enterprise customers. This policy specifies data lifecycle standards, retention intervals, and cryptographic erasure protocols governing customer uploaded datasets, metadata, and production transaction logs.

### Section 2: Customer Data Retention Lifecycle
All customer production datasets and stored records are subject to strict archival schedules:
1. **Active Operational Data:** Kept during the active term of customer subscription agreement.
2. **Post-Termination Retention:** Customer data will be permanently deleted after 30 days of contract termination or account closure notice.
3. **Disaster Recovery Backups:** Automated cold-storage system backups are retained and will be permanently purged after 90 days from creation.
4. **Audit and Invoicing Records:** Financial invoices and payment receipts are retained for 7 years to satisfy federal statutory tax mandates.

### Section 3: Geographic Storage and Data Sovereignty
All customer data, replication nodes, and primary storage volumes must be maintained exclusively in data centers located within US-East (Northern Virginia) and US-West (Oregon) facilities. Cross-border international replication outside the continental United States is strictly prohibited without written consent from the Customer Security Review Board.

### Section 4: Cryptographic Erasure and Verification
Upon expiration of the retention timeframe, CloudScale executes automated NIST SP 800-88 compliant cryptographic wiping across solid-state drives and physical partitions. A cryptographic Certificate of Erasure will be generated and made accessible to the customer within 10 business days of completed purging.

### Section 5: Notice of Modification
CloudScale reserves the right to amend non-material operational terms upon providing at least 30 days written notice to designated customer administrators.
