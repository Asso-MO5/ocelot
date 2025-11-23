import type { FastifyInstance } from 'fastify';
import type { Ticket } from './tickets.types.ts';
import { emailUtils } from '../email/email.utils.ts';
// @ts-ignore - qrcode n'a pas de types TypeScript officiels
import QRCode from 'qrcode';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Lit le logo en base64 depuis le fichier
 */
export function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), 'src', 'templates', 'logo-base64.txt');
    return readFileSync(logoPath, 'utf-8').trim();
  } catch (error) {
    // Si le fichier n'existe pas, retourner une chaîne vide
    return '';
  }
}

/**
 * Génère un QR code en base64 pour un ticket
 */
export async function generateQRCodeBase64(qrCode: string): Promise<string> {
  if (!qrCode || qrCode.trim().length === 0) {
    throw new Error('Le code QR ne peut pas être vide');
  }

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
    return qrCodeDataUrl;
  } catch (error: any) {
    throw new Error(`Erreur lors de la génération du QR code: ${error?.message || error}`);
  }
}

/**
 * Formate une date au format français ou anglais
 */
export function formatDate(dateString: string, language: 'fr' | 'en'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Si la date est invalide, retourner la date brute
      return dateString;
    }
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', options);
  } catch (error) {
    // En cas d'erreur, retourner la date brute
    return dateString;
  }
}

/**
 * Formate une heure (HH:MM)
 */
export function formatTime(timeString: string): string {
  try {
    if (!timeString || timeString.length < 5) {
      return timeString || '00:00';
    }
    return timeString.substring(0, 5); // Prendre seulement HH:MM
  } catch (error) {
    return timeString || '00:00';
  }
}

/**
 * Normalise la langue du ticket
 */
export function normalizeLanguage(ticketLanguage: string | null | undefined): 'fr' | 'en' {
  let language = (ticketLanguage?.split('-')[0]?.toLowerCase() ?? 'fr') as 'fr' | 'en';
  if (language !== 'fr' && language !== 'en') {
    language = 'fr';
  }
  return language;
}

/**
 * Prépare les données du ticket (montants convertis, nom du visiteur)
 */
export function prepareTicketData(ticket: Ticket) {
  const visitorName = ticket.first_name && ticket.last_name
    ? `${ticket.first_name} ${ticket.last_name}`
    : ticket.email;

  // Convertir les montants en nombres (PostgreSQL retourne les decimal comme strings)
  const ticketPrice = typeof ticket.ticket_price === 'string'
    ? parseFloat(ticket.ticket_price)
    : ticket.ticket_price;
  const donationAmount = typeof ticket.donation_amount === 'string'
    ? parseFloat(ticket.donation_amount)
    : ticket.donation_amount;
  const totalAmount = typeof ticket.total_amount === 'string'
    ? parseFloat(ticket.total_amount)
    : ticket.total_amount;

  return {
    visitorName,
    ticketPrice,
    donationAmount,
    totalAmount,
  };
}

/**
 * Options pour la génération du HTML du ticket
 */
interface TicketHTMLOptions {
  ticket: Ticket;
  language: 'fr' | 'en';
  qrCodeBase64: string;
  logoBase64: string;
  title: string;
  greeting?: string;
  intro?: string;
  footer?: string;
  statusBadge?: {
    isValid: boolean;
    validText: string;
    invalidText: string;
    invalidReason?: string;
  };
  statusRow?: {
    label: string;
    value: string;
  };
  viewTicketLink?: {
    url: string;
    text: string;
  };
  containerMaxWidth?: string;
  containerPadding?: string;
}

/**
 * Génère le HTML de base pour un ticket (utilisé pour email et page)
 */
function generateTicketHTMLBase(options: TicketHTMLOptions): string {
  const {
    ticket,
    language,
    qrCodeBase64,
    logoBase64,
    title,
    greeting,
    intro,
    footer,
    statusBadge,
    statusRow,
    viewTicketLink,
    containerMaxWidth = '600px',
    containerPadding = '30px',
  } = options;

  const { visitorName, ticketPrice, donationAmount, totalAmount } = prepareTicketData(ticket);

  const translations = {
    fr: {
      ticketDetails: 'Détails de votre billet',
      reservationDate: 'Date de réservation',
      timeSlot: 'Créneau horaire',
      ticketPrice: 'Prix du billet',
      donation: 'Don',
      total: 'Total',
      qrCodeTitle: 'Votre code QR',
      qrCodeDescription: 'Présentez ce code QR à l\'entrée du musée',
      museumName: 'Musée du Jeu Vidéo',
    },
    en: {
      ticketDetails: 'Ticket details',
      reservationDate: 'Reservation date',
      timeSlot: 'Time slot',
      ticketPrice: 'Ticket price',
      donation: 'Donation',
      total: 'Total',
      qrCodeTitle: 'Your QR code',
      qrCodeDescription: 'Present this QR code at the museum entrance',
      museumName: 'Video Game Museum',
    },
  };

  const t = translations[language];

  const baseStyles = `
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: ${containerMaxWidth};
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      padding: ${containerPadding};
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
      padding: 30px;
      background-color: black;
    }
    .logo img {
      max-width: 200px;
      height: auto;
    }
    h1 {
      color: #e73b21;
      text-align: center;
      margin-bottom: 20px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .visitor-name {
      text-align: center;
      font-size: 18px;
      margin-bottom: 30px;
      color: #666;
    }
    .ticket-details {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: bold;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .qr-code {
      text-align: center;
      margin: 30px 0;
    }
    .qr-code img {
      max-width: 300px;
      height: auto;
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      padding: 10px;
      background-color: #ffffff;
    }
    .qr-code-text {
      margin-top: 15px;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2px;
      color: #333;
      text-align: center;
    }
    .qr-description {
      margin-top: 10px;
      color: #666;
      font-size: 14px;
    }
    .view-ticket-link {
      display: block;
      text-align: center;
      margin: 30px 0;
      padding: 15px;
      background-color: #e73b21;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }
    .view-ticket-link:hover {
      background-color: #c52e18;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 14px;
    }
    @media print {
      body {
        background-color: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
      }
    }
  `;

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${logoBase64 ? `<div class="logo"><img src="${logoBase64}" alt="${t.museumName}" /></div>` : ''}
    <h1>${title}</h1>
    ${greeting ? `<div class="greeting">${greeting} ${visitorName},</div>` : ''}
    ${intro ? `<p>${intro}</p>` : ''}
    
    <div class="ticket-details">
      <h2>${t.ticketDetails}</h2>
      <div class="detail-row">
        <span class="detail-label">${t.reservationDate}:</span>
        <span class="detail-value">${formatDate(ticket.reservation_date, language)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">${t.timeSlot}:</span>
        <span class="detail-value">${formatTime(ticket.slot_start_time)} - ${formatTime(ticket.slot_end_time)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">${t.ticketPrice}:</span>
        <span class="detail-value">${ticketPrice.toFixed(2)}€</span>
      </div>
      ${donationAmount > 0 ? `
      <div class="detail-row">
        <span class="detail-label">${t.donation}:</span>
        <span class="detail-value">${donationAmount.toFixed(2)}€</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label"><strong>${t.total}:</strong></span>
        <span class="detail-value"><strong>${totalAmount.toFixed(2)}€</strong></span>
      </div>
      ${statusRow ? `
      <div class="detail-row">
        <span class="detail-label">${statusRow.label}:</span>
        <span class="detail-value">${statusRow.value}</span>
      </div>
      ` : ''}
    </div>

    <div class="qr-code">
      <h3>${t.qrCodeTitle}</h3>
      <img src="${qrCodeBase64}" alt="QR Code" />
      <p class="qr-code-text">${ticket.qr_code}</p>
      <p class="qr-description">${t.qrCodeDescription}</p>
    </div>

    ${viewTicketLink ? `<a href="${viewTicketLink.url}" class="view-ticket-link">${viewTicketLink.text}</a>` : ''}

    <div class="footer">
      ${footer ? `<p>${footer}</p>` : ''}
      <p><strong>${t.museumName}</strong></p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Génère le contenu HTML de l'email de confirmation de ticket
 */
async function generateTicketEmailHTML(
  ticket: Ticket,
  ticketViewUrl: string
): Promise<string> {
  const language = normalizeLanguage(ticket.language);
  const logoBase64 = getLogoBase64();

  // Générer le QR code avec gestion d'erreur
  let qrCodeBase64: string;
  try {
    qrCodeBase64 = await generateQRCodeBase64(ticket.qr_code);
  } catch (error) {
    throw new Error(`Erreur lors de la génération du QR code pour le ticket ${ticket.id}: ${error}`);
  }

  const translations = {
    fr: {
      subject: 'Votre billet pour le Musée du Jeu Vidéo',
      greeting: 'Bonjour',
      intro: 'Votre réservation a été confirmée !',
      viewTicket: 'Voir mon billet en ligne',
      footer: 'Merci de votre visite !',
    },
    en: {
      subject: 'Your ticket for the Video Game Museum',
      greeting: 'Hello',
      intro: 'Your reservation has been confirmed!',
      viewTicket: 'View my ticket online',
      footer: 'Thank you for your visit!',
    },
  };

  const t = translations[language];

  return generateTicketHTMLBase({
    ticket,
    language,
    qrCodeBase64,
    logoBase64,
    title: t.subject,
    greeting: t.greeting,
    intro: t.intro,
    footer: t.footer,
    viewTicketLink: {
      url: ticketViewUrl,
      text: t.viewTicket,
    },
  });
}

/**
 * Envoie un email de confirmation pour un ticket
 */
export async function sendTicketConfirmationEmail(
  app: FastifyInstance,
  ticket: Ticket,
  baseUrl: string = process.env.BASE_URL || 'http://localhost:4000'
): Promise<void> {
  try {
    // Ne pas envoyer d'email si le ticket n'est pas payé (non valide)
    if (ticket.status !== 'paid') {
      app.log.info({ ticketId: ticket.id, status: ticket.status }, 'Ticket non payé, email non envoyé');
      return;
    }

    const language = (ticket.language?.split('-')[0] ?? 'fr') as 'fr' | 'en';
    const ticketViewUrl = `${baseUrl}/tickets/${ticket.qr_code}`;
    let htmlContent = '';
    try {
      htmlContent = await generateTicketEmailHTML(ticket, ticketViewUrl);
    } catch (error: any) {
      app.log.error({
        error: error?.message || error,
        errorStack: error?.stack,
        ticketId: ticket.id,
        qrCode: ticket.qr_code,
        language: ticket.language
      }, 'Erreur lors de la génération du HTML de l\'email');
      return;
    }

    const visitorName = ticket.first_name && ticket.last_name
      ? `${ticket.first_name} ${ticket.last_name}`
      : ticket.email;

    const translations = {
      fr: {
        subject: 'Votre billet pour le Musée du Jeu Vidéo',
      },
      en: {
        subject: 'Your ticket for the Video Game Museum',
      },
    };

    // Générer le PDF du ticket
    let pdfAttachment = null;
    try {
      const { generateTicketPDF } = await import('./tickets.pdf.ts');
      const pdfBuffer = await generateTicketPDF(ticket, ticket.status === 'paid');

      // Si le PDF n'a pas été généré (ticket non valide), continuer sans PDF
      if (pdfBuffer) {
        const pdfBase64 = pdfBuffer.toString('base64');
        pdfAttachment = {
          name: `billet-${ticket.qr_code}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf',
        };
      }
    } catch (pdfError: any) {
      app.log.error({
        error: pdfError?.message || pdfError,
        ticketId: ticket.id,
        qrCode: ticket.qr_code,
      }, 'Erreur lors de la génération du PDF du ticket');
      // Continuer sans PDF si la génération échoue
    }

    await emailUtils.sendEmail({
      email: ticket.email,
      name: visitorName,
      subject: translations[language].subject,
      body: htmlContent,
      language,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });

    app.log.info({
      ticketId: ticket.id,
      email: ticket.email,
      pdfAttached: !!pdfAttachment
    }, 'Email de confirmation de ticket envoyé');
  } catch (error) {
    app.log.error({ error, ticketId: ticket.id }, 'Erreur lors de l\'envoi de l\'email de confirmation');
    // Ne pas faire échouer la création du ticket si l'email échoue
    // On log juste l'erreur
  }
}

/**
 * Envoie les emails de confirmation pour plusieurs tickets
 */
export async function sendTicketsConfirmationEmails(
  app: FastifyInstance,
  tickets: Ticket[],
  baseUrl?: string
): Promise<void> {
  // Envoyer les emails en parallèle (mais ne pas faire échouer si un échoue)
  await Promise.allSettled(
    tickets.map(ticket => sendTicketConfirmationEmail(app, ticket, baseUrl))
  );
}

/**
 * Génère le HTML de la page de visualisation du ticket
 */
export async function generateTicketViewHTML(
  ticket: Ticket,
  isValid: boolean
): Promise<string> {
  const language = normalizeLanguage(ticket.language);
  const logoBase64 = getLogoBase64();

  // Générer le QR code avec gestion d'erreur
  let qrCodeBase64: string;
  try {
    qrCodeBase64 = await generateQRCodeBase64(ticket.qr_code);
  } catch (error) {
    throw new Error(`Erreur lors de la génération du QR code pour le ticket ${ticket.id}: ${error}`);
  }

  const translations = {
    fr: {
      title: 'Votre billet',
      valid: 'Billet valide',
      invalid: 'Billet invalide',
      invalidReason: 'Ce billet n\'est plus valide',
      status: 'Statut',
      statusPaid: 'Payé',
      statusPending: 'En attente de paiement',
      statusCancelled: 'Annulé',
      statusUsed: 'Utilisé',
      statusExpired: 'Expiré',
    },
    en: {
      title: 'Your ticket',
      valid: 'Valid ticket',
      invalid: 'Invalid ticket',
      invalidReason: 'This ticket is no longer valid',
      status: 'Status',
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

  // Ne pas générer la page si le ticket n'est pas valide
  if (!isValid) {
    throw new Error('Ce billet n\'est pas valide');
  }

  return generateTicketHTMLBase({
    ticket,
    language,
    qrCodeBase64,
    logoBase64,
    title: `${t.title} - ${language === 'fr' ? 'Musée du Jeu Vidéo' : 'Video Game Museum'}`,
    statusRow: {
      label: t.status,
      value: statusLabels[ticket.status as keyof typeof statusLabels] || ticket.status,
    },
    containerMaxWidth: '800px',
    containerPadding: '40px',
  });
}

