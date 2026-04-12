---
name: retro-business-logic
description: "Infers functional requirements, business rules, validation logic, workflows, and user stories from legacy code behavior"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-business-logic -- Business Logic Extraction Skill

This skill is invoked by the Retro-Spec Coordinator as the fourth extraction skill. It analyzes the legacy codebase to infer functional requirements, business rules, validation logic, workflows, and user stories from actual code behavior. It produces Sections 4 (Functional Requirements), 5 (User Stories), and 6 (User Flows).

## Input Contract

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to companion artifacts directory |
| 4 | `discovery_manifest_path` | Path to the discovery manifest |
| 5 | `source_path` | Path to the legacy source code |
| 6 | `target_language` | Target language for artifacts |
| 7 | `project_name` | Name of the project |
| 8 | `module_filter` | Modules to analyze |

## Execution Sequence

1. **Read this SKILL.md**
2. **Read discovery manifest**
3. **Read accumulator** for architecture (Section 9), data model (Section 7), and API (Section 8) context
4. **Analyze business logic** in the legacy source code. Use `#tool:search/usages` to trace function call chains and `#tool:search/searchSubagent` for broad logic flow discovery.
5. **Write Sections 4, 5, 6** to the accumulator
6. **If MODULE-DEEP mode**: also write Sections 4B (Business Rules), 4C (Decision Logic), 4D (Computed Values), 4E (Side Effects) to the accumulator

## Extraction Depth Modes

This skill supports two extraction depth modes:

### PROJECT mode (default)
Standard extraction across all modules in the project. Produces FRs, user stories, and flows at feature-area granularity. Suitable for project-level specs.

### MODULE-DEEP mode
Triggered when the dispatch prompt contains `Extraction depth: MODULE-DEEP`. This mode performs exhaustive extraction within a SINGLE module:

1. **Read EVERY source file** in the module (not just service layer)
2. **Trace EVERY code path**: follow every if/else, switch/match, try/catch, loop, and early return
3. **Document EVERY business rule**: not just validation, but invariants, policies, computations, and conditional logic
4. **Map EVERY side effect**: events, notifications, logging, cache operations, external calls
5. **Trace inter-module calls**: for each outbound call, document what data is passed, what is returned, and the business reason
6. **Extract decision trees**: for complex conditional logic, build decision tables showing all input combinations and their outcomes
7. **Document temporal behavior**: ordering constraints, scheduling logic, rate limiting, cooldown periods, retry policies
8. **Capture domain terminology**: variable names, function names, and comments that reveal domain concepts

MODULE-DEEP produces additional subsections beyond standard FRs:

- **Section 4B -- Business Rules & Invariants**: Every invariant, constraint, and business rule as a numbered rule (BR-XXX)
- **Section 4C -- Decision Logic**: Decision tables for complex branching, with conditions and outcomes
- **Section 4D -- Computed Values**: Every calculation, derivation, and transformation with its formula and business meaning
- **Section 4E -- Side Effects & Events**: Every side effect triggered by operations, with trigger conditions and business purpose

## Constraints

- NEVER execute legacy code
- NEVER modify legacy source files
- Do NOT write sections other than 4, 5, 6 (and 4B-4E in MODULE-DEEP mode)
- Do NOT re-define data model entities (reference Section 7)
- Do NOT re-define API endpoints (reference Section 8)
- Use `[INFERRED: confidence]` for every FR, user story, and flow
- Business rules derived from test assertions get `[INFERRED: HIGH]`
- Business rules derived only from implementation code get `[INFERRED: MEDIUM]`
- Business rules derived from commented/dead code get `[INFERRED: LOW]`

---

## Extraction Procedure

### Step 1: Service Layer Analysis

The primary source of business rules is the service/use-case layer. For each service class/module identified in Section 9:

1. **Read the service file** in full
2. **For each public method**, analyze:
   - **Precondition checks**: Conditions verified before the main logic (auth checks, existence checks, permission checks)
   - **Validation logic**: Input validation beyond type checking (business rule validation)
   - **Core transformation**: What the method actually does (creates, updates, computes, transforms)
   - **Side effects**: Events emitted, notifications sent, logs written, caches invalidated
   - **Postconditions**: What state is guaranteed after successful execution
   - **Error paths**: Every throw/raise/return-error with the condition that triggers it
3. **Map to FR format**:
   - Each distinct behavior becomes an FR
   - The precondition check becomes the FR's Precondition
   - The core transformation becomes the FR's obligation statement
   - The guaranteed state becomes the FR's Postcondition
   - Each error path becomes the FR's Error behavior
4. **Extract business rules**: Beyond simple FRs, identify:
   - **Invariants**: Conditions the system enforces at all times (e.g., balance cannot be negative)
   - **Policies**: Configurable business rules (e.g., max login attempts, grace period duration)
   - **Computed values**: Derived fields and their formulas (e.g., total = sum(items.price * items.qty))
   - **Decision logic**: Non-trivial conditional branches with business meaning (e.g., discount tiers, approval workflows)
   - **Temporal rules**: Time-based constraints (e.g., cooldown periods, expiration windows, scheduling)

### Step 1b: Domain Model Analysis

Beyond the service layer, analyze domain-rich code to understand the business deeply:

1. **Domain concepts from naming**: Function names, variable names, class names, and enum values often encode domain terminology. Extract a domain glossary.
2. **Constants and magic numbers**: Named constants and inline magic numbers reveal business thresholds, limits, and policies. Document each with its business meaning.
3. **Configuration-driven behavior**: Config values that change system behavior reveal business-level tunables. Document what each config controls and its domain impact.
4. **Comments and TODOs**: Developer comments often explain the "why" behind business decisions. Extract domain insights from comments.

### Step 2: Validation Rule Extraction

Search for all validation logic to infer business constraints:

1. **Input validation patterns**:
   ```
   grep: "validate|isValid|check|assert|throw.*invalid|raise.*invalid|BadRequest|422|validateSync|safeParse|parse\("
   ```

2. **Conditional business rules**:
   ```
   grep: "if.*throw|if.*raise|if.*return.*error|guard|require\(|precondition"
   ```

3. **For each validation found**:
   - What field/input is being validated
   - What constraint is enforced (min, max, format, uniqueness, referential integrity)
   - What happens when validation fails (error code, message, HTTP status)
   - Is it a technical constraint (type check) or business rule (domain logic)?

4. **Classify validations**:
   - **Field-level**: Single field constraints (format, range, required) -> document in Section 7
   - **Cross-field**: Multi-field constraints (end_date > start_date) -> document as FR
   - **Business rule**: Domain logic constraints (cannot cancel shipped order) -> document as FR
   - **Authorization**: Permission checks -> document in Section 10.2

### Step 3: Workflow Detection

Identify multi-step processes and workflows:

1. **Sequential operations**: Methods that call multiple service methods in sequence
2. **State machine transitions**: Methods that move entities through states (reference Section 7 state machines)
3. **Saga/orchestration patterns**: Coordinated operations across multiple entities/services
4. **Scheduled jobs**: Cron jobs, background workers, periodic tasks
5. **Event chains**: Event emission -> handler -> further actions

For each workflow, document:
- Trigger: What initiates the workflow
- Steps: Sequential operations performed
- Decision points: Branches/conditions in the flow
- Error handling: What happens at each step on failure
- Compensation: Rollback or cleanup on partial failure

### Step 4: Permission and Authorization Analysis

Extract role-based or permission-based access control:

1. **Role definitions**: Enums or constants defining user roles
2. **Permission checks**: Middleware, decorators, or inline checks
3. **Resource ownership**: Checks like `user.id === resource.ownerId`
4. **Scope limitations**: Data filtering based on user context (multi-tenancy)

Build a permission matrix:
| Action | Role A | Role B | Role C | Source |
|--------|--------|--------|--------|--------|
| Create User | yes | no | no | <file:line> |

### Step 5: User Story Inference

From the extracted FRs, API endpoints, and workflows, infer user stories:

1. **Map endpoints to user actions**: Each API endpoint implies a user capability
2. **Identify actors**: From auth/role checks, identify distinct user types
3. **Derive benefit**: From the endpoint's purpose and domain context, infer why the user wants this
4. **Extract acceptance scenarios**: From validation rules and error paths, derive Given/When/Then scenarios
5. **Identify edge cases**: From error handling and boundary conditions

### Step 6: User Flow Construction

From workflows and endpoint sequences, construct user flows:

1. **Identify primary journeys**: The most common sequences of operations
2. **Map UI navigation** (if frontend code exists): Page transitions, form submissions
3. **Document step-by-step flows**: Actor actions, system responses, decision points
4. **Cross-reference with API endpoints**: Each flow step maps to one or more endpoints

---

## Section 4 Output Format

```markdown
## 4. Functional Requirements

### 4.1 <Feature Area>

- **FR-001**: The system SHALL <obligation statement>.
  [INFERRED: confidence] Source: <file:line>
  - Precondition: <condition>
  - Postcondition: <result state>
  - Error: <failure behavior>

- **FR-002**: The system SHALL validate that <business rule>.
  [INFERRED: MEDIUM] Source: <validation file:line>
  - Precondition: <input received>
  - Postcondition: <input accepted and processed>
  - Error: Return 422 with error key <KEY> when <condition>

#### Implementation Contract -- <Feature Area>

**Inputs**: <description with types, from Section 8>
**Outputs**: <description with types, from Section 7>
**Error behaviors**:
- <condition> -> <response> (Source: <file:line>)
```

## Section 5 Output Format

```markdown
## 5. User Stories

### US-01 -- <Title> (Priority: P1) MVP

**As a** <role>, **I want** <capability>, **so that** <benefit>.
[INFERRED: confidence]

**Why P1**: <rationale based on code evidence -- e.g., heavily used endpoint, core entity>

**Independent Test**: <how to verify>

**Acceptance Scenarios**:
1. **Given** <precondition>, **When** <action>, **Then** <result> (happy path)
   Source: <test file or handler:line>
2. **Given** <precondition>, **When** <action>, **Then** <result> (error path)
   Source: <error handling code:line>

### Edge Cases
- <edge case from code analysis>
```

## Section 6 Output Format

```markdown
## 6. User Flows

### 6.1 <Flow Name>

**Actor**: <role>
**Precondition**: <initial state>
**Trigger**: <initiating action>

1. **<Actor>** <action>
   - System: <response> [Source: <endpoint/handler:line>]
2. **System** <processing>
   - Calls: <service method> [Source: <file:line>]
3. **System** <response to actor>
   - Returns: <response shape from Section 8>

**Error paths**:
- At step N, if <condition>: <error handling>
```

---

## Priority Inference Heuristic

Since we cannot ask users about priority, infer from code signals:

| Signal | Inferred Priority | Confidence |
|--------|------------------|------------|
| Endpoint has extensive test coverage | P1 | HIGH |
| Entity is referenced by many other entities | P1 | HIGH |
| Feature has dedicated error handling | P1 | MEDIUM |
| Endpoint exists but has no tests | P2 | MEDIUM |
| Code exists but is behind a feature flag | P2 | MEDIUM |
| Code is commented out or in a `TODO` branch | P3 | LOW |
| Code exists in a `/experimental/` directory | P3 | LOW |

---

## MODULE-DEEP: Additional Output Sections

When operating in MODULE-DEEP mode, produce these additional sections AFTER Section 6:

### Section 4B -- Business Rules & Invariants

```markdown
## 4B. Business Rules & Invariants

### Invariants (must ALWAYS hold)

- **INV-001**: <invariant statement>
  Enforcement: <where/how the code enforces this>
  Violation handling: <what happens if violated>
  [INFERRED: confidence] Source: <file:line>

### Business Rules

- **BR-001**: <business rule statement>
  Trigger: <when this rule is evaluated>
  Condition: <the logical condition>
  Action: <what happens when the condition is true>
  Otherwise: <what happens when the condition is false>
  Business meaning: <why this rule exists in domain terms>
  [INFERRED: confidence] Source: <file:line>

### Authorization Rules

- **AR-001**: <who can do what>
  Resource: <entity/endpoint>
  Required: <role/permission/ownership>
  Enforcement: <middleware/guard/inline check>
  [INFERRED: confidence] Source: <file:line>
```

### Section 4C -- Decision Logic

```markdown
## 4C. Decision Logic

### DL-001: <Decision Name>

**Context**: <when this decision is made>
**Source**: <file:line range>
[INFERRED: confidence]

| # | Condition A | Condition B | Condition C | Outcome | Side Effects |
|---|------------|------------|------------|---------|-------------|
| 1 | true | true | * | <result> | <events/calls> |
| 2 | true | false | true | <result> | <events/calls> |
| 3 | true | false | false | <result> | <events/calls> |
| 4 | false | * | * | <result> | <events/calls> |

**Business interpretation**: <what this decision means in domain terms>
```

For simpler decisions (single condition), use inline format:
```markdown
- **DL-002**: If <condition>, then <outcome A>; otherwise <outcome B>.
  Business meaning: <domain interpretation>
  [INFERRED: confidence] Source: <file:line>
```

### Section 4D -- Computed Values

```markdown
## 4D. Computed Values & Transformations

- **CV-001**: <computed_field_name>
  Formula: <computation logic in pseudocode or formula>
  Inputs: <list of input fields/values with types>
  Output: <result type and range>
  Business meaning: <why this value is computed, what it represents>
  Used by: <which FRs, endpoints, or other computations depend on this>
  [INFERRED: confidence] Source: <file:line>

- **CV-002**: <transformation_name>
  Input shape: <source data structure>
  Output shape: <target data structure>
  Mapping:
    - source.fieldA -> target.fieldX (rename)
    - source.fieldB + source.fieldC -> target.fieldY (computed)
    - "default_value" -> target.fieldZ (constant)
  Business meaning: <why this transformation exists>
  [INFERRED: confidence] Source: <file:line>
```

### Section 4E -- Side Effects & Events

```markdown
## 4E. Side Effects & Events

### Events Produced

- **EVT-001**: <event_name>
  Trigger: <operation that produces this event>
  Payload: <event data shape>
  Consumers: <who/what listens for this event>
  Business meaning: <what this event signifies in domain terms>
  [INFERRED: confidence] Source: <file:line>

### External Calls

- **EXT-001**: <external_service_call>
  Trigger: <when this call is made>
  Request: <data sent>
  Response handling: <how response is used>
  Failure handling: <retry/fallback/error propagation>
  Business meaning: <why this external call is necessary>
  [INFERRED: confidence] Source: <file:line>

### Notifications & Messaging

- **NTF-001**: <notification_type>
  Trigger: <condition>
  Channel: <email/push/sms/webhook/queue>
  Recipient: <who receives it>
  Template/Content: <what is communicated>
  [INFERRED: confidence] Source: <file:line>

### Cache Operations

- **CACHE-001**: <cache_operation>
  Trigger: <when cache is read/written/invalidated>
  Key pattern: <cache key structure>
  TTL: <expiration>
  Invalidation: <what causes cache invalidation>
  [INFERRED: confidence] Source: <file:line>
```

---

## MODULE-DEEP: Extraction Technique for Complete Code Path Tracing

When in MODULE-DEEP mode, follow this systematic approach for EVERY public and significant internal function:

1. **Entry**: Read the function signature and first line of body
2. **Validation phase**: Identify all input validation (early returns, throws, asserts)
3. **Authorization phase**: Identify permission/role/ownership checks
4. **Pre-computation**: Identify data loading, lookups, and derived values
5. **Core logic**: Trace the main business operation line by line
6. **Branch analysis**: For each if/switch/match, document BOTH branches with business meaning
7. **Mutation**: Identify what data is created, updated, or deleted
8. **Side effects**: Identify events, notifications, cache ops, logging
9. **Response construction**: What is returned and how

Map each phase to the appropriate output section (FR, BR, DL, CV, SE, EVT, etc.).
