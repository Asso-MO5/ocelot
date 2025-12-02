import type { Ticket } from '../tickets/tickets.types.ts';
// @ts-ignore - pdfkit n'a pas de types TypeScript officiels
import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @description Converts a number to a string in french
 * @param {Number} n - Number to convert
 * @returns
 */
function mountToLetter(n: number): string {
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

/**
 * Obtient le chemin d'une image depuis le dossier data
 */
function getImagePathFromData(imageName: string): string {
  const imagePath = join(__dirname, 'data', imageName);
  try {
    // Vérifier que le fichier existe
    readFileSync(imagePath);
    return imagePath;
  } catch (error) {
    throw new Error(`Impossible de charger l'image ${imageName} depuis ${imagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Interface pour les données nécessaires à la génération du certificat
 */
export interface DonationProofData {
  amount: number;
  first_name: string;
  last_name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  date: Date;
  invoice_id: string; // ID de la facture/checkout
}

/**
 * Génère un certificat de don CERFA 11580 en PDF
 * @param data Données du donateur et du don
 * @returns Buffer du PDF généré
 */
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
      // === PAGE 1 ===
      const cerfa1Path = getImagePathFromData('cerfa_11580_1.png');
      doc.image(cerfa1Path, 0, 0, { width: 595, height: 842 }); // A4 en points (595 x 842)

      // === Case donateur ===


      // === INFO ASSO ===
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

      // orga d'interet general
      doc.fontSize(14)
        .text('X', 40, 378);

      // === PAGE 2 ===
      doc.addPage();

      const cerfa2Path = getImagePathFromData('cerfa_11580_2.png');
      doc.image(cerfa2Path, 0, 0, { width: 595, height: 842 });

      // === ID ====
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

      // === Amount ===
      doc.fontSize(10)
        .text(amount.toString(), 230, 197)
        .text(
          `${mountToLetter(Math.round(amount))} euro${Math.round(amount) > 1 ? 's' : ''}`,
          154,
          224
        );

      // === donation date ===
      doc.fontSize(13)
        .text(day.toString(), 190, 250)
        .text(month.toString(), 218, 250)
        .text(year.toString(), 268, 250);

      // === Checkboxes ===
      doc.fontSize(14);
      // 200 du CGI
      doc.text('X', 145, 291);
      // 238 du CGI
      doc.text('X', 291, 291);
      // don manuel
      doc.text('X', 328, 343);
      // numeraire
      doc.text('X', 37, 408);
      // Case mode versement
      doc.text('X', 328, 474);

      // Date signature
      doc.fontSize(13)
        .text(day.toString(), 400, 705)
        .text(month.toString(), 420, 705)
        .text(year.toString(), 445, 705);

      // Finaliser le PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Génère un certificat de don à partir d'un ticket
 * Si le ticket a un don (donation_amount > 0), génère le certificat
 * @param ticket Ticket avec don
 * @param address Adresse complète (optionnelle, peut être récupérée depuis Galette)
 * @param postal_code Code postal (optionnel)
 * @param city Ville (optionnelle)
 * @returns Buffer du PDF ou null si pas de don
 */
export async function generateDonationProofFromTicket(
  ticket: Ticket,
  address?: string,
  postal_code?: string,
  city?: string
): Promise<Buffer | null> {
  // Ne pas générer si pas de don
  const donationAmount = typeof ticket.donation_amount === 'string'
    ? parseFloat(ticket.donation_amount)
    : ticket.donation_amount;

  if (!donationAmount || donationAmount <= 0) {
    return null;
  }

  // Utiliser la date de création du ticket comme date du don
  const donationDate = new Date(ticket.created_at);

  // Générer un ID de facture basé sur le checkout_id ou l'ID du ticket
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
