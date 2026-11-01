# Feature Specification: Chat Endpoint Contract

**Feature Branch**: `[003-chat-endpoint]`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "POST /chat em src/http/server.ts (ou padrão do express): body{message, strategy?, reflect?, conversationId?} validado com zod; default react.
200 { answer, trace, metrics, conversationId } com `metrics.historyMessages`; 400 body inválido (issues do zod); 422 estratégia desconhecida; timeout de 60 segundos -> 504. registry em src/agents/index.ts (nome -> estratégia, refletc aplica withReflection).
Conversa persistente com 12 últimas mensagens no prompt. Teste de integração com estratégia fake determinística, sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sending a standard chat request (Priority: P1)

As an API consumer, I can send a chat message with only the required content and receive a successful response with the generated answer and execution telemetry.

**Why this priority**: This is the core capability that enables any downstream workflow depending on conversational responses.

**Independent Test**: Can be fully tested by sending a valid request containing only `message` and confirming a successful response with all expected output fields.

**Acceptance Scenarios**:

1. **Given** a valid message and no optional fields, **When** the client submits a chat request, **Then** the system processes it using the default strategy and returns a successful response containing answer, trace, and metrics.
2. **Given** a valid message and explicit optional fields, **When** the client submits a chat request, **Then** the system applies the selected strategy and reflection choice and returns answer, trace, and metrics.

---

### User Story 2 - Receiving actionable validation errors (Priority: P2)

As an API consumer, I can receive structured validation errors when my request body is invalid so I can correct payload issues quickly.

**Why this priority**: Clear feedback reduces integration friction and prevents repeated invalid calls.

**Independent Test**: Can be fully tested by sending malformed requests and validating that the response clearly identifies validation issues.

**Acceptance Scenarios**:

1. **Given** a request with missing or invalid body fields, **When** the client submits the request, **Then** the system returns a validation error including field-level issues.
2. **Given** a request containing unsupported extra fields, **When** the client submits the request, **Then** the system returns a validation error including issues for unknown fields.

---

### User Story 3 - Handling unsupported strategy selection (Priority: P3)

As an API consumer, I can receive a domain-level error when requesting an unsupported strategy so I can choose a valid strategy name.

**Why this priority**: This ensures predictable behavior when multiple strategies are available and prevents silent fallbacks.

**Independent Test**: Can be fully tested by sending a request with an unknown strategy value and verifying the specific unsupported-strategy error response.

**Acceptance Scenarios**:

1. **Given** a request containing a strategy name that is not registered, **When** the client submits the request, **Then** the system rejects it with an explicit unknown-strategy response.

---

### User Story 4 - Avoiding indefinite wait during processing (Priority: P3)

As an API consumer, I can receive a timeout response when processing exceeds the defined limit so my client can fail fast and recover.

**Why this priority**: Operational reliability requires bounded response time and deterministic timeout behavior.

**Independent Test**: Can be fully tested by forcing processing to exceed the timeout threshold and confirming the expected timeout response.

**Acceptance Scenarios**:

1. **Given** a valid request whose processing exceeds the maximum allowed duration, **When** the timeout threshold is reached, **Then** the system terminates the request and returns a timeout response.

### Edge Cases

- What happens when `message` is an empty string or contains only whitespace?
- How does the system respond when `reflect` is provided with a non-boolean value?
- What happens when a strategy exists but fails during execution before producing output?
- How does timeout handling behave when processing completes exactly at the threshold boundary?
- How does the API behave when `conversationId` is provided but has no persisted messages yet?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a chat request entry point that accepts a body containing `message` and optional `strategy` and `reflect` fields.
- **FR-002**: System MUST validate all chat request bodies against a strict schema before processing.
- **FR-003**: System MUST reject request bodies that include unsupported extra fields and return structured validation issues.
- **FR-004**: System MUST use the standard strategy when `strategy` is omitted.
- **FR-005**: System MUST resolve requested strategies by name from a central strategy registry.
- **FR-006**: System MUST reject requests that reference non-registered strategy names with an explicit unknown-strategy response.
- **FR-007**: System MUST apply reflection behavior only when explicitly requested and supported by the selected strategy flow.
- **FR-008**: System MUST return a successful response containing `answer`, `trace`, and `metrics` for valid, completed requests.
- **FR-009**: System MUST return validation errors including structured issue details when the request body is invalid.
- **FR-010**: System MUST enforce a maximum processing duration of 60 seconds per chat request.
- **FR-011**: System MUST return a timeout response when processing exceeds the maximum duration.
- **FR-012**: System MUST provide deterministic integration-level verification using a fake strategy that does not rely on external network access.
- **FR-013**: System MUST accept an optional `conversationId` in chat requests and return `conversationId` in successful responses.
- **FR-014**: System MUST create a persistent conversation context when `conversationId` is omitted or unknown.
- **FR-015**: System MUST compose strategy input with up to the 12 most recent persisted conversation messages in chronological order.
- **FR-016**: System MUST persist only user messages and assistant final answers for conversation history.
- **FR-017**: System MUST include `historyMessages` in response metrics to indicate how many historical messages were used in prompt composition.

### Key Entities *(include if feature involves data)*

- **Chat Request**: Input payload containing the user message and optional behavior selectors (`strategy`, `reflect`).
- **Strategy Registry Entry**: Named strategy definition that maps a public identifier to executable chat behavior.
- **Chat Response**: Output payload containing `answer`, `trace`, and `metrics`.
- **Conversation**: Logical interaction thread identified by `conversationId`.
- **Conversation Message**: Persisted user or assistant message tied to a conversation with chronological ordering.
- **Validation Issue**: Structured detail describing field-level contract violations in invalid requests.
- **Timeout Outcome**: Error response emitted when request processing exceeds the allowed duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid chat requests without optional selectors complete successfully using the default strategy and return all required response fields.
- **SC-002**: 100% of invalid chat request payloads are rejected with structured validation details that identify each invalid field, including unknown fields.
- **SC-003**: 100% of requests using unknown strategies are rejected with the defined unsupported-strategy error outcome.
- **SC-004**: 100% of requests that exceed the defined duration threshold return a timeout outcome within an expected bounded response window.
- **SC-005**: Integration verification runs without external network dependency and produces deterministic pass/fail results for core request flows.
- **SC-006**: 100% of successful chat responses include a `conversationId` and accurate `historyMessages` count consistent with persisted history usage.

## Assumptions

- The chat endpoint is consumed by authenticated or trusted callers handled by existing platform controls outside this feature's scope.
- Existing strategy implementations can be referenced through a shared registry without changing external client contracts.
- A single default strategy name is already agreed for standard chat behavior.
- Timeout handling uses existing platform response patterns for gateway-like failures.
- Test environments can inject or register deterministic fake strategies for integration verification.
