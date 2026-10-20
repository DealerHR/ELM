# Growth Profile Assessment - Scoring Model & Psychometric Framework

## Overview

The Growth Profile Assessment is a scientifically validated personality profiling tool designed specifically for Small and Medium Enterprise (SME) environments. It evaluates candidates across critical dimensions that predict success in dynamic, resource-constrained, fast-paced organizational settings.

The assessment employs multiple anti-faking mechanisms to ensure response authenticity, including forced-choice items, social desirability traps, and non-transparent scoring keys.

## Theoretical Foundation

The assessment is built on:
- **Big Five Personality Traits** (OCEAN model)
- **Growth Mindset Theory** (Carol Dweck)
- **Entrepreneurial Orientation** research
- **Adaptability & Resilience** frameworks
- **SME Success Factors** from organizational psychology
- **Ipsative / Forced-Choice Methodology** for impression management resistance

---

## Assessment Dimensions (5 Core Traits)

### 1. Adaptability & Learning Agility (ALA)
**Definition**: Ability to learn quickly, adapt to change, and thrive in ambiguous situations.

**Sub-dimensions**:
- **Change Embrace** (25%): Comfort with organizational change and new processes
- **Learning Speed** (25%): Ability to acquire new skills rapidly
- **Ambiguity Tolerance** (25%): Comfort working with incomplete information
- **Problem Solving** (25%): Creative thinking and solution finding

**Scoring Range**: 0-100
- 0-40: Limited — May struggle in dynamic environments
- 41-65: Developing — Can adapt with support
- 66-85: Good to Strong — Thrives in change
- 86-100: Exceptional — Change catalyst

---

### 2. Initiative & Ownership (IO)
**Definition**: Self-starting behavior, accountability, and proactive problem-solving without constant supervision.

**Sub-dimensions**:
- **Self-Direction** (30%): Works independently without constant oversight
- **Proactive Behavior** (25%): Anticipates needs and acts before being asked
- **Accountability** (25%): Takes ownership of outcomes
- **Resource Optimization** (20%): Makes do with available resources

**Scoring Range**: 0-100
- 0-40: Limited — Requires significant direction
- 41-65: Developing — Self-sufficient with guidance
- 66-85: Good to Strong — Highly independent
- 86-100: Exceptional — Entrepreneurial drive

---

### 3. Collaboration & Team Dynamics (CTD)
**Definition**: Ability to work effectively in small, cross-functional teams where everyone's contribution matters.

**Sub-dimensions**:
- **Communication** (30%): Clear, direct communication style
- **Team Support** (25%): Helping others and sharing knowledge
- **Conflict Resolution** (20%): Handling disagreements constructively
- **Cross-functional Work** (25%): Working across departments/roles

**Scoring Range**: 0-100
- 0-40: Limited — May create friction
- 41-65: Developing — Works well in teams
- 66-85: Good to Strong — Team enhancer
- 86-100: Exceptional — Team multiplier

---

### 4. Resilience & Stress Management (RSM)
**Definition**: Mental toughness, emotional stability, and ability to maintain performance under pressure.

**Sub-dimensions**:
- **Stress Tolerance** (30%): Performance under pressure
- **Emotional Stability** (25%): Consistent emotional responses
- **Recovery Speed** (20%): Bouncing back from setbacks
- **Optimism** (25%): Positive outlook despite challenges

**Scoring Range**: 0-100
- 0-40: Limited — May burn out quickly
- 41-65: Developing — Manages stress adequately
- 66-85: Good to Strong — Thrives under pressure
- 86-100: Exceptional — Unshakeable composure

---

### 5. Growth Orientation & Curiosity (GOC)
**Definition**: Continuous improvement mindset, intellectual curiosity, and desire for professional development.

**Sub-dimensions**:
- **Growth Mindset** (30%): Belief in ability to develop skills
- **Intellectual Curiosity** (25%): Desire to learn and explore
- **Feedback Receptivity** (25%): Openness to constructive criticism
- **Innovation Tendency** (20%): Seeking better ways to do things

**Scoring Range**: 0-100
- 0-40: Limited — Fixed mindset tendencies
- 41-65: Developing — Open to growth
- 66-85: Good to Strong — Active self-developer
- 86-100: Exceptional — Growth champion

---

## Overall Score Interpretation

| Score | Fit Level | Meaning |
|-------|-----------|---------|
| 0–40 | Limited Fit | May struggle; high risk of turnover or performance issues |
| 41–54 | Developing Fit | Potential with structured support and mentorship |
| 55–69 | Good Fit | Solid SME readiness; contributes with normal onboarding |
| 70–84 | Strong Fit | Excels in SME competencies; high growth potential |
| 85–100 | Exceptional Fit | Ideal SME profile; potential leadership material |

---

## Level-Based Dimension Weighting

### Entry Level (Junior roles, 0–2 years experience)
| Dimension | Weight |
|-----------|--------|
| Adaptability & Learning Agility | 25% |
| Initiative & Ownership | 15% |
| Collaboration & Team Dynamics | 25% |
| Resilience & Stress Management | 15% |
| Growth Orientation & Curiosity | 20% |

*Rationale*: Entry-level roles prioritize learning ability, teamwork, and growth potential over complete independence.

### Mid Level (3–7 years experience)
| Dimension | Weight |
|-----------|--------|
| Adaptability & Learning Agility | 20% |
| Initiative & Ownership | 25% |
| Collaboration & Team Dynamics | 20% |
| Resilience & Stress Management | 20% |
| Growth Orientation & Curiosity | 15% |

*Rationale*: Mid-level roles require balanced capabilities with emphasis on ownership and resilience.

### Senior Level (8+ years experience)
| Dimension | Weight |
|-----------|--------|
| Adaptability & Learning Agility | 20% |
| Initiative & Ownership | 30% |
| Collaboration & Team Dynamics | 15% |
| Resilience & Stress Management | 25% |
| Growth Orientation & Curiosity | 10% |

*Rationale*: Senior roles demand high ownership, stress management, and proven adaptability.

---

## Scoring Algorithm

### Step 1: Apply Scoring Key (per question)

Every question has a `scoring_key` JSONB field that maps the raw answer (1–5) to an effective score (1–5). This key is hidden from candidates.

```
For each response:
  raw_answer = candidate's selected option (1–5)

  if question has scoring_key:
    effective_score = scoring_key[raw_answer]
  else if is_reverse_scored:
    effective_score = 6 - raw_answer
  else:
    effective_score = raw_answer
```

This means the "best" answer is **not always option 5**. Non-transparent ordering prevents candidates from gaming the scale by always selecting the last option.

**Forced-choice questions** have only two options (A and B). Their scoring_key maps `{"1": score_a, "2": score_b}` directly.

### Step 2: Sub-dimension Score Normalization

For each sub-dimension, average the effective scores across its questions, then normalize to 0–100:

```
sub_dim_avg = sum(effective_scores) / count(questions in sub-dimension)
sub_dim_score = round((sub_dim_avg / 5) × 100)
```

### Step 3: Dimension Score Calculation

Weight and aggregate sub-dimension scores within each dimension:

```
dim_score = sum(sub_dim_score × sub_dim_weight) / sum(sub_dim_weights)
```

### Step 4: Overall Score Calculation

Apply level-specific dimension weights:

```
overall_score = sum(dim_score × level_dim_weight) / sum(level_dim_weights)
```

### Step 5: Social Desirability Index & Response Validity

The 5 social desirability trap questions (one per dimension, Q10/Q20/Q30/Q40/Q50) have reversed scoring keys — choosing the "perfect" answer (e.g., "I have never procrastinated") maps to an effective score of **1**, while the honest self-aware answer maps to an effective score of **5**.

SDI is computed from the **effective scores** (after applying the scoring_key), not the raw answer index. This is critical: a candidate who honestly selects "I have struggled" (raw option 1 or 2) receives an effective score of 5, producing a high SDI. A candidate who claims "I have never struggled" (raw option 5) receives an effective score of 1, producing a low SDI.

```
For each trap question:
  effective_trap_score = scoring_key[raw_answer]   ← NOT the raw answer itself

trap_avg = sum(effective_trap_scores on 5 trap questions) / 5
social_desirability_index = round((trap_avg / 5) × 100)

response_validity:
  social_desirability_index >= 55  →  valid
  social_desirability_index 40–54  →  caution
  social_desirability_index < 40   →  suspect
```

A **valid** index means the candidate acknowledged realistic human limitations on the trap items (honest self-awareness). A **suspect** index means they claimed implausible perfection across multiple dimensions (raw option 4 or 5 on most traps).

---

## Anti-Faking Architecture

The assessment uses four overlapping strategies to reduce impression management:

### 1. Forced-Choice Pairs (10 of 50 questions)
Pairs of equally desirable statements where only one scores the target trait. Candidates cannot pick "both good options" — they must choose. The scored option is not obvious.

Questions: 3, 7, 15, 17, 25, 27, 35, 37, 41, 46, 48 (approximate set, one or two additional applied per dimension)

### 2. Social Desirability Traps (5 of 50 questions)
One trap per dimension (Q10, Q20, Q30, Q40, Q50). These present a gradient where the highest option is a perfectionistic claim no reasonable person can honestly endorse (e.g., "I have never had difficulty working with any colleague"). The scoring key rewards the self-aware middle-range answer, not the extreme.

### 3. Non-Transparent Scoring Keys
For Likert-scale items, the option that scores highest is not always the last option. Example:

- Q2: "I waited until someone could walk me through it" → scores 1
- Q2: "I experimented, made mistakes, and figured it out" → scores 5
- Q2: "I watched a tutorial once and felt confident immediately" → scores 2 (overconfidence signal)

Candidates who always select the last option will score poorly on questions where the scoring key maps option 5 to a low value.

### 4. Behavioral Specificity
All options describe realistic, professionally plausible behaviors. There are no obviously bad options to avoid. This forces genuine reflection rather than simple rejection of "bad" choices.

---

## Question Distribution

| Dimension | Total Questions | Forced Choice | SD Traps | Likert/Freq |
|-----------|-----------------|---------------|----------|-------------|
| Adaptability & Learning | 10 | 2 | 1 | 7 |
| Initiative & Ownership | 10 | 2 | 1 | 7 |
| Collaboration & Team | 10 | 2 | 1 | 7 |
| Resilience & Stress | 10 | 2 | 1 | 7 |
| Growth Curiosity | 10 | 2 | 1 | 7 |
| **Total** | **50** | **10** | **5** | **35** |

---

## Fit Level Classification

| Score | Fit Level | HR Guidance |
|-------|-----------|-------------|
| 85–100 | Exceptional | Fast-track to interview; strong leadership potential |
| 70–84 | Strong | Proceed with confidence; minimal risk |
| 55–69 | Good | Proceed; discuss development plan in interview |
| 40–54 | Developing | Proceed with caution; requires onboarding support |
| 0–39 | Limited | Recommend only if domain skills are exceptional |

---

## Response Validity Guidance for HR

When reviewing results, always check the **Response Validity** flag:

| Validity | SDI Range | HR Action |
|----------|-----------|-----------|
| Valid | 55–100 | Trust scores at face value |
| Caution | 40–54 | Consider probing on scored dimensions in interview |
| Suspect | 0–39 | Scores likely inflated; conduct behavioral interview to verify |

A "Suspect" rating does **not** automatically disqualify a candidate. It means the self-report scores may overestimate true tendencies. Structured behavioral interview questions ("Tell me about a time when…") should be used to cross-validate.

---

## Score Report Components

### 1. Executive Summary
- Overall Growth Profile Score (0–100)
- Fit level classification
- Recruiter narrative paragraph

### 2. Dimension Breakdown
- Score for each of 5 dimensions (0–100)
- Per-dimension interpretive text
- Strengths and development areas

### 3. Response Validity
- Social Desirability Index
- Validity classification (Valid / Caution / Suspect)
- Recommended HR action

### 4. Calculation Details (Technical)
- Level applied, dimension weights used
- Per-dimension scores, response count

---

## Validity & Reliability Measures

### Content Validity
- Questions reviewed against SME success literature
- Behavioral anchors grounded in real workplace scenarios
- Anti-faking design reviewed against psychometric best practices

### Construct Validity
- Five-factor structure aligned with OCEAN and SME success research
- Discriminant validity supported by distinct sub-dimensions

### Criterion Validity
- Predictive validity: Scores designed to correlate with 6-month performance
- Concurrent validity: Scores calibrated to distinguish high/low performers

### Reliability
- Internal consistency target: Cronbach's α > 0.80 per dimension
- Test-retest reliability target: > 0.75 over 2-week period

---

## Implementation Notes

### For Platform Admins
- Questions are standardized; cannot be edited by organizations
- Scoring keys are stored server-side only; never exposed to the candidate UI
- Social desirability index computed automatically on submission

### For HR Managers
- Activate Growth Profile per invitation alongside domain assessments
- View individual scores and validity flags in the Candidates panel
- Use "Detailed Responses" to review question-level answers with effective scores

### For Candidates
- 50 questions, approximately 25–30 minutes
- Progress is saved automatically between pages
- Cannot review or revise previous answers after page submission
- Scores are computed immediately on final submission

---

## Version Control

**Version 2.0** — Anti-Faking Release
- Added forced-choice pairs (10 questions) to prevent social desirability inflation
- Added social desirability traps (5 questions) with reversed scoring keys
- Introduced non-transparent scoring_key per question
- Added response validity classification (Valid / Caution / Suspect)
- Scoring engine implemented as a Supabase Edge Function
- Updated all 50 questions with behavioral specificity and non-obvious answer ordering

**Version 1.0** — Initial Release
- 50 Likert-scale questions across 5 dimensions
- 3 level-specific weightings
- Basic reverse scoring only
