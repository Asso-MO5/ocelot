import type { Ticket } from './tickets.types.ts';
// @ts-ignore - pdfkit n'a pas de types TypeScript officiels
import PDFDocument from 'pdfkit';
import {
  generateQRCodeBase64,
  formatDate,
  formatTime,
  normalizeLanguage,
  prepareTicketData,
  getLogoBase64,
} from './tickets.email.ts';

/**
 * Génère un PDF du ticket
 * Retourne null si le ticket n'est pas valide
 */
export async function generateTicketPDF(
  ticket: Ticket,
  isValid: boolean = true
): Promise<Buffer | null> {
  // Ne pas générer le PDF si le ticket n'est pas valide
  if (!isValid) {
    return null;
  }

  const language = normalizeLanguage(ticket.language);
  const { visitorName, ticketPrice, donationAmount, totalAmount } = prepareTicketData(ticket);

  // Générer le QR code avant de créer le document
  const qrCodeBase64 = await generateQRCodeBase64(ticket.qr_code);
  const qrCodeBuffer = Buffer.from(qrCodeBase64.split(',')[1] || qrCodeBase64, 'base64');

  // Créer le document PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  // Buffer pour stocker le PDF
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on('error', reject);

    try {
      // Couleur principale du musée
      const primaryColor = '#e73b21';
      const secondaryColor = '#666';
      const backgroundColor = '#f9f9f9';

      // Logo (si disponible)
      const logoBase64 = getLogoBase64();
      if (logoBase64) {
        try {
          // Convertir base64 en buffer
          const logoBuffer = Buffer.from(logoBase64.split(',')[1] || logoBase64, 'base64');
          doc.image(logoBuffer, {
            fit: [200, 100],
            align: 'center',
          });
          doc.moveDown(1);
        } catch (error) {
          // Si le logo ne peut pas être chargé, continuer sans
        }
      }

      // Titre
      doc.fontSize(24)
        .fillColor(primaryColor)
        .text(language === 'fr' ? 'Votre billet' : 'Your ticket', {
          align: 'center',
        })
        .moveDown(0.5);

      // Nom du visiteur
      doc.fontSize(16)
        .fillColor(secondaryColor)
        .text(visitorName, {
          align: 'center',
        })
        .moveDown(1);

      // Détails du ticket
      const translations = {
        fr: {
          ticketDetails: 'Détails de votre billet',
          reservationDate: 'Date de réservation',
          timeSlot: 'Créneau horaire',
          ticketPrice: 'Prix du billet',
          donation: 'Don',
          total: 'Total',
          status: 'Statut',
          qrCodeTitle: 'Votre code QR',
          qrCodeDescription: 'Présentez ce code QR à l\'entrée du musée',
          museumName: 'Musée du Jeu Vidéo',
          statusPaid: 'Payé',
          statusPending: 'En attente de paiement',
          statusCancelled: 'Annulé',
          statusUsed: 'Utilisé',
          statusExpired: 'Expiré',
        },
        en: {
          ticketDetails: 'Ticket details',
          reservationDate: 'Reservation date',
          timeSlot: 'Time slot',
          ticketPrice: 'Ticket price',
          donation: 'Donation',
          total: 'Total',
          status: 'Status',
          qrCodeTitle: 'Your QR code',
          qrCodeDescription: 'Present this QR code at the museum entrance',
          museumName: 'Video Game Museum',
          statusPaid: 'Paid',
          statusPending: 'Pending payment',
          statusCancelled: 'Cancelled',
          statusUsed: 'Used',
          statusExpired: 'Expired',
        },
      };

      const t = translations[language];
      const statusLabels = {
        paid: t.statusPaid,
        pending: t.statusPending,
        cancelled: t.statusCancelled,
        used: t.statusUsed,
        expired: t.statusExpired,
      };

      // Section détails
      doc.fontSize(18)
        .fillColor('#333')
        .text(t.ticketDetails, {
          align: 'left',
        })
        .moveDown(0.5);

      // Fond gris pour la section détails
      const detailsY = doc.y;
      doc.rect(50, detailsY, 495, 200)
        .fillColor(backgroundColor)
        .fill()
        .fillColor('#333');

      // Détails du ticket
      let currentY = detailsY + 20;
      const lineHeight = 25;
      const labelWidth = 200;
      const valueWidth = 250;

      // Date de réservation
      doc.fontSize(12)
        .fillColor(secondaryColor)
        .text(t.reservationDate + ':', 60, currentY, { width: labelWidth })
        .fillColor('#333')
        .text(formatDate(ticket.reservation_date, language), 260, currentY, { width: valueWidth });
      currentY += lineHeight;

      // Créneau horaire
      doc.fillColor(secondaryColor)
        .text(t.timeSlot + ':', 60, currentY, { width: labelWidth })
        .fillColor('#333')
        .text(
          `${formatTime(ticket.slot_start_time)} - ${formatTime(ticket.slot_end_time)}`,
          260,
          currentY,
          { width: valueWidth }
        );
      currentY += lineHeight;

      // Prix du billet
      doc.fillColor(secondaryColor)
        .text(t.ticketPrice + ':', 60, currentY, { width: labelWidth })
        .fillColor('#333')
        .text(`${ticketPrice.toFixed(2)}€`, 260, currentY, { width: valueWidth });
      currentY += lineHeight;

      // Don (si > 0)
      if (donationAmount > 0) {
        doc.fillColor(secondaryColor)
          .text(t.donation + ':', 60, currentY, { width: labelWidth })
          .fillColor('#333')
          .text(`${donationAmount.toFixed(2)}€`, 260, currentY, { width: valueWidth });
        currentY += lineHeight;
      }

      // Total
      doc.font('Helvetica-Bold')
        .fillColor(secondaryColor)
        .text(t.total + ':', 60, currentY, { width: labelWidth })
        .fillColor('#333')
        .text(`${totalAmount.toFixed(2)}€`, 260, currentY, { width: valueWidth });
      currentY += lineHeight;

      // Statut
      doc.font('Helvetica')
        .fillColor(secondaryColor)
        .text(t.status + ':', 60, currentY, { width: labelWidth })
        .fillColor('#333')
        .text(
          statusLabels[ticket.status as keyof typeof statusLabels] || ticket.status,
          260,
          currentY,
          { width: valueWidth }
        );

      // Position pour le QR code
      doc.y = detailsY + 220;

      // QR Code
      doc.moveDown(1)
        .fontSize(16)
        .fillColor('#333')
        .text(t.qrCodeTitle, {
          align: 'center',
        })
        .moveDown(0.5);

      // Centrer le QR code (en tenant compte des marges de 50 points de chaque côté)
      const qrSize = 200;
      const pageWidth = 595; // A4 width = 595 points
      const leftMargin = 50;
      const rightMargin = 50;
      const usableWidth = pageWidth - leftMargin - rightMargin; // 495 points
      const qrX = leftMargin + (usableWidth - qrSize) / 2; // Centré dans la zone utilisable
      doc.image(qrCodeBuffer, qrX, doc.y, {
        width: qrSize,
        height: qrSize,
      });

      doc.y += qrSize + 10;

      // Code QR en texte
      doc.fontSize(16)
        .font('Courier')
        .fillColor('#333')
        .text(ticket.qr_code, {
          align: 'center',
          letterSpacing: 2,
        })
        .moveDown(0.5);

      // Description
      doc.fontSize(12)
        .font('Helvetica')
        .fillColor(secondaryColor)
        .text(t.qrCodeDescription, {
          align: 'center',
        })
        .moveDown(2);

      // Footer
      doc.fontSize(12)
        .fillColor(secondaryColor)
        .text(t.museumName, {
          align: 'center',
        });

      // Finaliser le PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

