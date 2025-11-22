/**
 * Type pour les erreurs structurées avec traductions
 */
export interface StructuredError {
  code: number; // Code HTTP
  fr: string; // Message en français
  en: string; // Message en anglais
}

/**
 * Crée une erreur structurée avec traductions
 */
export function createStructuredError(
  code: number,
  fr: string,
  en: string
): Error {
  const error: StructuredError = { code, fr, en };
  return new Error(JSON.stringify(error));
}

/**
 * Parse une erreur pour vérifier si c'est une erreur structurée
 */
export function parseStructuredError(error: Error): StructuredError | null {
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
    // Ce n'est pas du JSON ou pas au bon format
  }
  return null;
}

/**
 * Gère une erreur dans un handler Fastify
 * Retourne la réponse appropriée si c'est une erreur structurée, sinon null
 */
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

