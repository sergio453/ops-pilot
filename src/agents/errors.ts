export class StoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownServiceError extends StoryError {
  constructor(serviceId: string) {
    super(`Service "${serviceId}" not found in story`);
  }
}

export class UnknownIncidentError extends StoryError {
  constructor(incidentId: string) {
    super(`Incident "${incidentId}" not found`);
  }
}

export class UnknownRunbookError extends StoryError {
  constructor(serviceId: string) {
    super(`Runbook for service "${serviceId}" not found`);
  }
}

export class InvalidCritiqueResultError extends StoryError {
  constructor(details: string) {
    super(`Critique result is invalid: ${details}`);
  }
}
