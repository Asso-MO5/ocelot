export interface StructuredError {
  code: number; // Code HTTP
  fr: string; // Message en français
  en: string; // Message en anglais
}

export function createStructuredError(
  code: number,
  fr: string,
  en: string
): Error {
  const error: StructuredError = { code, fr, en };
  return new Error(JSON.stringify(error));
}


function parseStructuredError(error: Error): StructuredError | null {
  try {
    const parsed = JSON.parse(error.message);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.code === 'number' &&
      typeof parsed.fr === 'string' &&
      typeof parsed.en === 'string'
    ) {
      return parsed as StructuredError;
    }
  } catch {
  }
  return null;
}

export function handleStructuredError(
  error: Error,
  reply: any
): { sent: boolean } {
  const structuredError = parseStructuredError(error);
  if (structuredError) {
    reply.code(structuredError.code).send({
      error: JSON.stringify(structuredError),
    });
    return { sent: true };
  }
  return { sent: false };
}

