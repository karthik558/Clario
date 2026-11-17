# OpenAI Usage and Privacy Policy (2023 Comprehensive Baseline)

**Document Classification:** Official Enterprise Regulatory Policy  
**Effective Date:** January 15, 2023  
**Version:** 2023.1.0  
**Governing Jurisdiction:** State of California, United States  
**Applicability:** Developer API Services, ChatGPT Consumer Services, and Commercial Integrations

---

### Page 1: Governance, Legal Scope & Jurisdictional Authority

#### 1.1 Organizational Commitment and Purpose
OpenAI OpCo, LLC ("OpenAI", "we", "us", or "our") establishes this Usage and Privacy Policy to define the operational, legal, and privacy boundaries governing our platform services, foundation model endpoints, and software development kits (SDKs). This document sets forth binding terms for all registered developers, commercial partners, and consumer end-users accessing OpenAI infrastructure throughout the 2023 operational calendar.

#### 1.2 Jurisdictional Precedence and Statutory Adherence
This agreement is executed under the substantive laws of the State of California, without regard to choice of law principles. All service interactions and data processing activities adhere to applicable international and federal privacy statutes, including the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA), the European Union General Data Protection Regulation (Regulation EU 2016/679), and relevant federal cybersecurity guidelines.

#### 1.3 Service Tiers and Scope of Coverage
The provisions contained herein apply differentially across three distinct operational categories:
1. **Commercial Developer API Tier:** Programmatic access via secure HTTP authentication tokens to endpoints including `v1/completions`, `v1/chat/completions`, `v1/embeddings`, and `v1/fine-tunes`.
2. **Consumer ChatGPT Applications:** Web and mobile conversational user interfaces operating under standard individual subscription or free-tier authentication.
3. **Enterprise Dedicated Deployments:** Tailored cloud instances provisioned under custom enterprise master services agreements (MSAs).

<!-- pagebreak -->

### Page 2: Architecture, API Request Pipeline & Telemetry Processing

#### 2.1 Ingestion Gateway Architecture
All incoming programmatic requests to OpenAI API endpoints pass through an enterprise-grade API gateway designed for multi-tenant isolation, rate limiting, and transport layer verification. Every API payload is verified using TLS 1.3 encryption in transit. Requests lacking valid cryptographic authorization headers are rejected immediately at the perimeter layer.

#### 2.2 In-Flight Payload Handling
When a payload reaches the inference cluster, the request is decrypted within volatile memory (RAM) allocated to high-performance inference accelerators:
- **Stateless Inference:** Prompt tokens and generated output tokens exist in active accelerator memory only for the duration required to execute forward-pass matrix calculations.
- **Buffer Cleansing:** Volatile GPU and TPU buffers are wiped and zero-filled between distinct tenant execution batches to eliminate cross-session data remanence.
- **Distributed Telemetry:** System performance metrics (token counts, request latency, HTTP status codes, and error categories) are decoupled from payload content and stored in telemetry analytics tables.

#### 2.3 Regional Ingestion Routing
During the 2023 calendar period, primary API inference clusters are situated predominantly in United States data centers (US-East and US-West). While international routing gateways accelerate request transport, customer payloads are processed on compute infrastructure physically located within the continental United States.

<!-- pagebreak -->

### Page 3: Data Retention & Customer Logging Protocols

#### 3.1 Standard API Data Retention Period
OpenAI enforces a strict default data retention protocol for all commercial API traffic:
1. **30-Day Storage Window:** Customer inputs (prompts) and model completions generated through the commercial API are retained in secure, encrypted cold-storage logs for a maximum period of **30 days** from the timestamp of ingestion.
2. **Purpose of Retention:** This 30-day storage window exists solely for the identification and investigation of platform abuse, denial-of-service attempts, hate speech generation, malware creation, and violations of acceptable use policies.
3. **Automated Purging:** Upon the expiration of the **30 days** retention window, customer API logs are automatically and permanently purged from production databases through automated cron deletion routines.

#### 3.2 Model Training Exclusion for Commercial API
OpenAI explicitly warrants that customer data submitted through the commercial API is **never** utilized for foundation model training or system improvements:
- Customer prompts submitted via API endpoints are strictly excluded from pre-training datasets.
- Generated completions from API endpoints are not fed back into reinforcement learning from human feedback (RLHF) pipelines.
- Customer intellectual property and proprietary trade secrets contained in API calls remain the unencumbered property of the customer.

#### 3.3 Consumer ChatGPT Service Differences
In contrast to the commercial API, data submitted through consumer ChatGPT web and mobile interfaces is subject to distinct rules:
- Consumer interactions are retained on server clusters and may be used by OpenAI to train, refine, and optimize subsequent model generations.
- Consumer users retain the statutory right to opt out of training by adjusting account settings or submitting the official privacy opt-out form.

<!-- pagebreak -->

### Page 4: Customer Fine-Tuning & Custom Weights Protection

#### 4.1 Fine-Tuning Ingestion and Data Boundaries
Enterprise customers utilizing the `v1/fine-tunes` endpoint upload paired prompt-completion training datasets formatted in JSON Lines (JSONL). OpenAI handles training files with rigorous segregation protocols:
- Training files uploaded by a tenant are encrypted at rest using AES-256 keys managed by OpenAI's Hardware Security Modules (HSMs).
- Uploaded training corpora are accessible exclusively by the tenant's authenticated administrative team and authorized OpenAI engineering personnel conducting automated validation.

#### 4.2 Model Weight Isolation and Exclusivity
When fine-tuning completes, the resulting specialized model weights are mathematically isolated:
- Custom weights are bound exclusively to the initiating organization's Organization ID.
- No other OpenAI tenant or third party can invoke, query, or infer across the customer's customized model.
- OpenAI engineers do not inspect custom weight deltas without explicit written consent from the customer during escalated support engagements.

#### 4.3 Deprecation and Deletion of Fine-Tuned Models
Customers maintain full operational discretion to decommission fine-tuned models at any time via the API delete endpoint. Upon execution:
- Custom checkpoint weights are scheduled for immediate decommission.
- Underlying training files are purged from cloud storage within 30 days of the customer's deletion request.

<!-- pagebreak -->

### Page 5: Security Architecture, SOC-2 Controls & Incident Notification

#### 5.1 Physical and Environmental Safeguards
OpenAI infrastructure is hosted in Tier-3 and Tier-4 data centers equipped with biometric physical access controls, continuous closed-circuit surveillance, redundant uninterruptible power supplies (UPS), and advanced climate management systems. Physical server access is restricted to verified datacenter technicians.

#### 5.2 Cryptographic Standards and Certifications
All customer data maintained across OpenAI systems is protected by rigorous cryptographic controls:
- **Encryption at Rest:** All stored databases, backups, and log files are encrypted with AES-256 encryption.
- **Encryption in Transit:** All external communication terminates using TLS 1.3 or TLS 1.2 with robust cipher suites.
- **Compliance Baseline:** OpenAI maintains active compliance with SOC-2 Type II standards, undergoing independent third-party annual audits covering security, availability, and confidentiality trust principles.

#### 5.3 Security Incident Notification Timeline
In the event of a verified security incident resulting in unauthorized access to customer confidential data or API transmission records:
- OpenAI security teams shall initiate forensic containment immediately upon incident discovery.
- OpenAI covenants to deliver formal written notification of the confirmed security breach to designated customer technical and legal contacts within **30 days** of forensic validation.
- The notification shall detail the nature of the breach, affected customer identifiers, estimated data scope, and remedial actions undertaken.

<!-- pagebreak -->

### Page 6: Commercial Limitation of Liability & Indemnity Caps

#### 6.1 Disclaimer of Warranties
OpenAI provides its developer platform, models, and associated APIs on an "as-is" and "as-available" basis. Except as expressly provided in these terms, OpenAI makes no warranties of any kind, whether express, implied, statutory, or otherwise, including warranties of merchantability, fitness for a particular purpose, non-infringement, or uninterrupted error-free operation.

#### 6.2 Aggregate Liability Ceiling
Under this 2023 baseline agreement, the financial exposure of OpenAI is strictly capped:
- To the maximum extent permitted by applicable law, in no event shall OpenAI's aggregate cumulative liability arising out of or related to this agreement, the API, or generated outputs exceed the total amount of **$100.00 USD** (one hundred United States dollars) or the net service fees paid by the customer to OpenAI in the one (1) month preceding the event giving rise to liability.
- Neither party shall be liable for indirect, incidental, consequential, special, punitive, or exemplary damages, including lost profits, loss of goodwill, business interruption, or loss of data.

#### 6.3 Customer Indemnification Responsibilities
The customer agrees to defend, indemnify, and hold harmless OpenAI, its affiliates, directors, officers, and employees against any third-party claims, damages, liabilities, and expenses arising out of:
- Customer applications built upon OpenAI APIs.
- End-user outputs distributed in violation of applicable laws.
- Infringement claims stemming from customer training datasets uploaded to fine-tuning endpoints.

<!-- pagebreak -->

### Page 7: Disallowed Use Categories, Red-Teaming & Enforcement Escalation

#### 7.1 Prohibited Application Domains
OpenAI strictly prohibits the utilization of its models and APIs for the following high-risk applications:
1. **Illegal Activities & Cyberweapons:** Development of malware, ransomware, weaponized exploits, automated phishing generators, or unauthorized access tools.
2. **Weapons & Explosives:** Generation of schematics, manufacturing instructions, or deployment guides for biological, chemical, radiological, or kinetic weapons.
3. **Unauthorized Legal & Medical Advice:** Providing unreviewed diagnostic health conclusions or legal representation without qualified human oversight.
4. **High-Stakes Automated Decision Making:** Automated denial of credit, housing, employment, or educational opportunities without human review.
5. **Political Campaigning & Micro-Targeting:** Generating personalized political propaganda or mass persuasion materials for political candidates.

#### 7.2 Automated Safety Guardrails and Moderation API
All developers must implement OpenAI's free Moderation API endpoint (`v1/moderations`) or equivalent internal safety filters to screen inputs and outputs for hate, self-harm, sexual violence, and harassment before serving responses to end-users.

#### 7.3 Enforcement and Account Suspension Protocol
If OpenAI detects recurring violations of the acceptable use policy:
- **Tier 1 - Warning Advisory:** Formal email notification detailing offending request hashes with a 48-hour cure window.
- **Tier 2 - Rate Throttling:** Temporary reduction of API tokens-per-minute (TPM) limits by 50% until compliance verification.
- **Tier 3 - Immediate Termination:** Revocation of API access keys and forfeiture of unused credits for severe non-compliance.

<!-- pagebreak -->

### Page 8: Regulatory Cross-Reference & Authorized Signatures

#### 8.1 European Union GDPR Data Processing Addendum (DPA)
For customers processing personal data of European Economic Area (EEA), Swiss, or UK data subjects, the OpenAI Standard Data Processing Addendum constitutes an integral part of this policy under Article 28 of Regulation (EU) 2016/679:
- OpenAI acts strictly as a **Data Processor**, while the customer acts as the **Data Controller**.
- Standard Contractual Clauses (SCCs) approved by the European Commission are incorporated by reference for international data transfers.
- Sub-processors engaged by OpenAI undergo security vetting and are subject to equivalent contractual safeguards.

#### 8.2 United States State Privacy Laws (CCPA / CPRA)
OpenAI certifies that in processing personal data via the commercial API:
- OpenAI does not "sell" or "share" customer personal information as defined under the California Consumer Privacy Act.
- OpenAI processes customer personal data solely for specified business purposes on behalf of the customer.

#### 8.3 Health Insurance Portability and Accountability Act (HIPAA)
Notice regarding Protected Health Information (PHI):
- As of the 2023 calendar period, OpenAI does **not** execute standard Business Associate Agreements (BAAs) for the commercial API tier.
- Customers subject to HIPAA are prohibited from transmitting unencrypted PHI to standard OpenAI API endpoints.

#### 8.4 Policy Review Schedule and Sign-Off
- **Executive Review Date:** January 15, 2023  
- **Approved by:** Office of General Counsel & Chief Information Security Officer  
- **Archival Reference:** `OAI-POL-2023-V1.0-ENTERPRISE`