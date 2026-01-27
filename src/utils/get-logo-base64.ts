import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), 'src', 'templates', 'logo-base64.txt');

    return readFileSync(logoPath, 'utf-8').trim();
  } catch (error) {
    return '';
  }
}

