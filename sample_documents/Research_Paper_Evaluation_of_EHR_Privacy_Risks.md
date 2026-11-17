# Empirical Evaluation of Privacy Leakage in Synthetic EHR Models
**Authors:** Dr. Rajiv Patel, Sophia Lin, Cybersecurity & AI Trust Lab  
**Publication:** Proceedings of Machine Learning Privacy & Safety (MLPS), 2024  

---

### Abstract
Recent clinical research claims that tabular electronic health record (EHR) synthesizers provide complete membership privacy under nominal differential privacy calibrations. In this paper, we challenge these assertions through calibrated Shadow Model membership inference attacks on differentially private medical data generators.

### Shadow Model Adversarial Attack Setup
We trained 50 shadow generative models across three benchmark clinical repositories (MIMIC-IV, eICU, and SyntheticCare). We implemented shadow membership inference attacks evaluating privacy leakage at varying epsilon parameters ranging from 0.1 to 1.2.

### Critical Contradiction of Prior Immunity Claims
Contrary to prior studies asserting that differential privacy budgets of epsilon = 0.5 offer complete protection against re-identification, our empirical results demonstrate that setting epsilon > 0.3 yields statistically significant membership inference vulnerabilities. Specifically, at epsilon = 0.5, our shadow classifier achieved a membership inference attack precision of 78.4% and an F1 score of 0.72. Rare genomic biomarkers and rare disease diagnoses exhibited up to 41.2% re-identification vulnerability.

### Conclusion and Recommendations
Prior claims asserting complete patient immunity at epsilon = 0.5 are empirically invalid in high-dimensional tabular datasets. We recommend reducing the maximum allowable differential privacy budget to epsilon = 0.25 for high-risk rare disease cohorts.
