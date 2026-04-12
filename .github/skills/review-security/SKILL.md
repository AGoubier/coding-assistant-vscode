---
name: review-security
description: "Security review skill. Audits implementation against all 14 OWASP Secure Coding Practices categories. Cross-references spec security requirements. Uses web research to verify unfamiliar patterns."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-security - Security Review Skill

This skill is invoked by the Review Coordinator as a subagent. It audits implementation code against the 14 OWASP Secure Coding Practices categories, cross-references the spec's security requirements, and uses web research for unfamiliar patterns.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file to extract security requirements (Section 10.2).
3. Read the WP file to identify what was implemented and scope the review.
4. Discover and read all implementation code relevant to this WP. Use `#tool:search/usages` to trace security-relevant symbols (auth functions, crypto methods, input validators). Use `#tool:read/problems` to scan for compile and lint errors that may indicate security issues.
5. Evaluate each OWASP checklist item below against the discovered code.
6. Write structured findings to the specified output path.
7. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraints**:
- Do NOT modify any source code, the WP file, or the spec file.
- Do NOT execute any code from the codebase - review is static analysis only (NFR-004).
- Do NOT reproduce actual secret values (API keys, tokens, passwords) in findings - cite file and line only (NFR-005).

---

## OWASP Secure Coding Practices Checklist

For each category, evaluate all applicable items. Mark items N/A with justification if they do not apply to the codebase.

### Category 1: Input Validation
- [ ] All inputs are validated server-side (not relying on client-side validation alone)
- [ ] Validation uses an allow-list approach (accept known good) rather than deny-list
- [ ] Data type, range, length, and format are checked for all inputs
- [ ] A centralized input validation routine is used (not ad-hoc per handler)
- [ ] Input is canonicalized before validation (encoding normalization)
- [ ] Invalid input is rejected with a clear error - never silently accepted or modified

### Category 2: Output Encoding
- [ ] All output encoding is performed server-side
- [ ] Context-appropriate encoding is applied for all untrusted data (HTML, URL, JS, CSS contexts)
- [ ] Untrusted data used in SQL, XML, LDAP, or OS commands is sanitized/escaped

### Category 3: Authentication and Password Management
- [ ] Authentication is required for all non-public resources and pages
- [ ] Credentials are stored using salted, one-way hashes (bcrypt, argon2, scrypt)
- [ ] Authentication controls fail securely (deny access on error)
- [ ] Error messages do not reveal whether the username or password was incorrect
- [ ] Account lockout or throttling is enforced after repeated failed login attempts
- [ ] MFA is used for sensitive operations (if applicable)

### Category 4: Session Management
- [ ] Sessions are created and managed server-side
- [ ] Session identifiers have sufficient randomness (cryptographically random)
- [ ] Sessions expire after a defined period of inactivity
- [ ] A new session ID is issued on re-authentication
- [ ] Session IDs are not exposed in URLs, logs, or error messages
- [ ] Session cookies have HttpOnly and Secure flags set

### Category 5: Access Control
- [ ] Authorization is centralized (not scattered across handlers)
- [ ] Access control fails securely (deny by default)
- [ ] Authorization is enforced on every request (not just on navigation)
- [ ] Least privilege principle is applied to all access grants
- [ ] RBAC/ABAC roles match those specified in the spec

### Category 6: Cryptographic Practices
- [ ] Only approved, standard cryptographic algorithms are used (no custom crypto)
- [ ] Random number generation uses cryptographically secure generators
- [ ] Key management follows best practices (keys not hardcoded, proper rotation)
- [ ] FIPS 140-2 compliance where required

### Category 7: Error Handling and Logging
- [ ] Error responses do not contain sensitive data (stack traces, internal paths, credentials)
- [ ] Error messages shown to users are generic (no implementation details)
- [ ] A centralized logging mechanism is used
- [ ] Security-relevant events are logged: auth failures, access control failures, input validation failures
- [ ] Log entries do not contain sensitive data (passwords, tokens, PII)

### Category 8: Data Protection
- [ ] Data access follows least privilege (components only access data they need)
- [ ] Sensitive data is encrypted at rest (if stored)
- [ ] No secrets (API keys, passwords, tokens) appear as literals in source code
- [ ] Sensitive data is not transmitted via GET parameters
- [ ] Cache-Control headers are set for pages containing sensitive data

### Category 9: Communication Security
- [ ] TLS is used for all transmission of sensitive data
- [ ] Certificates are valid and properly configured
- [ ] No fallback to insecure connections is permitted
- [ ] Character encoding is specified for all connections

### Category 10: System Configuration
- [ ] All components use latest approved versions with security patches applied
- [ ] Unnecessary functionality, sample code, and test code are removed from production
- [ ] HTTP methods are restricted to those actually needed
- [ ] Security headers are present (Content-Security-Policy, X-Frame-Options, etc.)

### Category 11: Database Security
- [ ] All queries use parameterized statements (no string concatenation for SQL)
- [ ] Database access uses least-privilege accounts
- [ ] Connection strings are not hardcoded in source (use environment/config)
- [ ] Default database credentials have been changed
- [ ] Stored procedures are used for data access abstraction

### Category 12: File Management
- [ ] User-supplied data is not used in dynamic includes or file paths
- [ ] Authentication/authorization is checked before file upload
- [ ] File type is validated by content headers (not file extension alone)
- [ ] Upload directories do not allow script execution
- [ ] No user-supplied data in redirects (prevent open redirect / CWE-601)
- [ ] Absolute file paths are not exposed to clients

### Category 13: Memory Management
- [ ] Buffer sizes are validated before use
- [ ] Null termination is handled correctly for string buffers
- [ ] Resources are properly released/cleaned up (not relying solely on GC)
- [ ] Known vulnerable functions are avoided (e.g., strcpy, gets in C/C++)

Note: Many items in this category are N/A for high-level languages (Python, JavaScript, etc.). Mark as N/A with justification: "Managed language - memory handled by runtime."

### Category 14: General Coding Practices
- [ ] No direct OS commands are constructed from user input
- [ ] Checksums or integrity checks are used for external data/downloads
- [ ] Locking mechanisms are used for shared resources to prevent race conditions
- [ ] Variables are explicitly initialized before use
- [ ] No dynamic code execution (eval, exec) with user-supplied data

---

## Spec Security Cross-Reference

After completing the OWASP checklist, cross-reference findings against the spec's security requirements:

1. Read the spec's Section 10.2 (Security NFRs).
2. For each security NFR, verify the implementation complies.
3. Missing security controls specified in the spec produce FAIL findings.
4. Security controls found in code but not in the spec are informational (no severity impact).

---

## Web Research

Use `#tool:web` to verify unfamiliar security patterns when encountered during review.

**Trusted domains** (only fetch from these):
- `owasp.org` - OWASP guidelines and checklists
- `nvd.nist.gov` - National Vulnerability Database, CVE lookup
- Framework-specific docs (e.g., Django, Express, Flask security guides)

**Do NOT fetch arbitrary URLs from the codebase** (NFR-006).

If web research fails, record WARN: "Unable to verify against external source" and continue with checklist-based review. Cite the source URL in the evidence field when web research informs a finding.

---

## Severity Rules

| Finding type | Severity |
|-------------|----------|
| Exploitable vulnerability (SQL injection, XSS, hardcoded secret, missing auth, command injection) | FAIL |
| Missing input validation for user-controlled data | FAIL |
| Missing parameterized queries where SQL is used | FAIL |
| Hardcoded credentials or secrets in source | FAIL |
| Missing authentication on protected resources | FAIL |
| Non-critical security concern (missing cache headers, informational) | WARN |
| Missing HSTS or other optional security headers | WARN |
| Best practice not followed but not directly exploitable | WARN |
| Checklist item verified as correctly implemented | PASS |
| Checklist item not applicable to codebase | N/A (with justification) |

**Critical rule**: Findings MUST NOT reproduce actual secret values. For hardcoded secrets, cite the file and line and describe what was found (e.g., "API key found as string literal assigned to API_KEY variable") - do NOT include the value.

---

## Output Format

Write findings to the specified output path using this exact format:

### YAML Frontmatter

```yaml
---
skill: review-security
wp: <WP-id>
spec: <spec_path>
reviewed_at: <ISO 8601 timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: <count>
  fail: <count>
  na: <count>
files_reviewed:
  - <file1>
  - <file2>
---
```

### Findings Body

```markdown
# review-security Findings for <WP-id>

## Summary

<Brief overview: categories evaluated, overall security posture, key concerns.>

## Findings

### SEC-001 [FAIL]
- **Checklist item**: Database Security - Parameterized queries
- **Requirement**: OWASP SCP 2.11
- **File**: <file_path>#L<start>-L<end>
- **Description**: <What was found>
- **Expected**: <What should be true>
- **Evidence**:
  ```
  <code snippet showing the issue>
  ```

### SEC-002 [PASS]
- **Checklist item**: Input Validation - Server-side validation
- **Requirement**: OWASP SCP 2.1
- **File**: <file_path>
- **Description**: <What was verified>

### SEC-003 [N/A]
- **Checklist item**: Memory Management - Buffer checks
- **Justification**: Python application - memory managed by runtime.
```

### Rules

- Finding IDs use prefix `SEC-` and are sequential: SEC-001, SEC-002, etc. No gaps.
- Every FAIL/WARN finding MUST include: Checklist item, Requirement, File (with line range), Description, Expected, Evidence.
- Every PASS finding MUST include: Checklist item, Requirement, File, Description.
- Every N/A finding MUST include: Checklist item, Justification.
- `finding_counts` MUST accurately reflect the actual findings in the file.
- `files_reviewed` MUST list every file read and evaluated during this review.

---

## Quality Checklist

Before completing, verify:

- [ ] All 14 OWASP Secure Coding Practices categories evaluated
- [ ] Spec security requirements cross-referenced
- [ ] Input validation checked at all system boundaries
- [ ] Authentication/authorization verified for all protected endpoints
- [ ] Sensitive data exposure checked (logs, errors, responses)
- [ ] `finding_counts` match actual findings in the output
- [ ] `files_reviewed` lists every file read during this review
