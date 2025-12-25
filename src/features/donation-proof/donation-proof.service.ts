import type { Ticket } from '../tickets/tickets.types.ts';
// @ts-ignore - pdfkit n'a pas de types TypeScript officiels
import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function mountToLetter(n: number): string {
  if (n === 0) {
    return "";
  }

  const unite = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
  ];
  const dizaines = [
    "",
    "dix",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ];

  if (n < 17) {
    return unite[n];
  } else if (n < 20) {
    return "dix-" + unite[n - 10];
  } else if (n < 100) {
    if (n % 10 === 0) {
      return dizaines[n / 10];
    } else if (n < 70 || (n > 80 && n < 91)) {
      return dizaines[Math.floor(n / 10)] + "-" + unite[n % 10];
    } else {
      return dizaines[Math.floor(n / 10)] + (n % 10 === 1 ? " et " : "-") + unite[n % 10];
    }
  } else if (n < 1000) {
    if (n === 100) {
      return "cent";
    } else {
      return (n < 200 ? "cent " : unite[Math.floor(n / 100)] + " cent ") + mountToLetter(n % 100);
    }
  } else if (n < 2000) {
    return "mille " + mountToLetter(n % 1000);
  } else if (n < 1000000) {
    return (
      mountToLetter(Math.floor(n / 1000)) +
      " mille " +
      (n % 1000 !== 0 ? mountToLetter(n % 1000) : "")
    );
  } else {
    return "Nombre trop grand";
  }
}

function getImagePathFromData(imageName: string): string {
  const imagePath = join(__dirname, 'data', imageName);
  try {
    readFileSync(imagePath);
    return imagePath;
  } catch (error) {
    throw new Error(`Impossible de charger l'image ${imageName} depuis ${imagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface DonationProofData {
  amount: number;
  first_name: string;
  last_name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  date: Date;
  invoice_id: string;
}

export async function generateDonationProofPDF(
  data: DonationProofData
): Promise<Buffer> {
  const { amount, first_name, last_name, address, postal_code, city, date, invoice_id } = data;

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on('error', reject);

    try {
      const cerfa1Path = getImagePathFromData('cerfa_11580_1.png');
      doc.image(cerfa1Path, 0, 0, { width: 595, height: 842 });

      doc.fontSize(12)
        .text('Association MO5.com', 150, 114);

      doc.fontSize(12)
        .text('8', 57, 146)
        .text('Boulevard Serrurier', 110, 146)
        .text('75019', 96, 160)
        .text('Paris', 197, 160)
        .text(
          "Association MO5.com pour la sauvegarde de l'informatique et des jeux vidéo",
          79,
          188,
          { width: 400 }
        );

      doc.fontSize(14)
        .text('X', 40, 378);

      doc.addPage();

      const cerfa2Path = getImagePathFromData('cerfa_11580_2.png');
      doc.image(cerfa2Path, 0, 0, { width: 595, height: 842 });

      doc.fontSize(12)
        .font('Helvetica')
        .fillColor('black')
        .text(last_name || '', 65, 65)
        .text(first_name || '', 347, 65);

      if (address) {
        doc.text(address, 80, 103);
      }

      if (postal_code) {
        doc.text(postal_code, 95, 122);
      }
      if (city) {
        doc.text(city, 215, 122);
      }

      doc.fontSize(10)
        .text(amount.toString(), 230, 197)
        .text(
          `${mountToLetter(Math.round(amount))} euro${Math.round(amount) > 1 ? 's' : ''}`,
          154,
          224
        );

      doc.fontSize(13)
        .text(day.toString(), 190, 250)
        .text(month.toString(), 218, 250)
        .text(year.toString(), 268, 250);

      doc.fontSize(14);
      doc.text('X', 145, 291);
      doc.text('X', 291, 291);
      doc.text('X', 328, 343);
      doc.text('X', 37, 408);
      doc.text('X', 328, 474);

      doc.fontSize(13)
        .text(day.toString(), 400, 705)
        .text(month.toString(), 420, 705)
        .text(year.toString(), 445, 705);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateDonationProofFromTicket(
  ticket: Ticket,
  address?: string,
  postal_code?: string,
  city?: string
): Promise<Buffer | null> {
  const donationAmount = typeof ticket.donation_amount === 'string'
    ? parseFloat(ticket.donation_amount)
    : ticket.donation_amount;

  if (!donationAmount || donationAmount <= 0) {
    return null;
  }

  const donationDate = new Date(ticket.created_at);
  const invoiceId = ticket.checkout_reference || ticket.checkout_id || ticket.id.substring(0, 8).toUpperCase();

  return generateDonationProofPDF({
    amount: donationAmount,
    first_name: ticket.first_name || '',
    last_name: ticket.last_name || '',
    address: address,
    postal_code: postal_code,
    city: city,
    date: donationDate,
    invoice_id: invoiceId,
  });
}
