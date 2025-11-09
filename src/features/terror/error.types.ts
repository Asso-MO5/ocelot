export interface ErrorContext {
  url?: string;
  method?: string;
  ip?: string;
  type?: string;
}

export interface ErrorPayload {
  error: Error;
  context: ErrorContext;
  timestamp: Date;
}

