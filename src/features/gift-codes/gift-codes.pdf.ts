// @ts-ignore - pdfkit n'a pas de types TypeScript officiels
import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogoBase64 } from '../../utils/get-logo-base64.ts';

let cachedMuseumImageBase64: string | null = null;

function getMuseumImageBase64(): string {
  try {
    if (cachedMuseumImageBase64) {
      return cachedMuseumImageBase64;
    }
    const imgPath = join(process.cwd(), 'src', 'templates', 'img-museaum-base64.txt');
    const content = readFileSync(imgPath, 'utf-8').trim();
    cachedMuseumImageBase64 = content;
    return content;
  } catch {
    return '';
  }
}

export async function generateGiftCodePDF(
  code: string,
  language: 'fr' | 'en' = 'fr'
): Promise<Buffer> {

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on('error', reject);

    const primaryColor = '#e73b21';
    const secondaryColor = '#666';
    const textColor = '#333';

    try {

      const translations = {
        fr: {
          headerLine:
            'Un lieu unique en France, entièrement consacré à l\'histoire, à la culture et à la mémoire du jeu vidéo.',
          addressLine: '10 Av. Paul Doumer, 94110 Arcueil - RER B : Laplace',
          giftCodeLabel: 'Code Cadeau :',
          reservationLabel: 'Réservation :',
          reservationUrlLabel: 'Musée du Jeu Vidéo.org',
          title: 'Votre code cadeau',
          museumName: 'Musée du Jeu Vidéo',
        },
        en: {
          headerLine:
            'A unique place in France, entirely dedicated to the history, culture and memory of video games.',
          addressLine: '10 Av. Paul Doumer, 94110 Arcueil - RER B: Laplace',
          giftCodeLabel: 'Gift code:',
          reservationLabel: 'Booking:',
          reservationUrlLabel: 'Video Game Museum.org',
          title: 'Your gift code',
          museumName: 'Video Game Museum',
        },
      } as const;

      const t = translations[language] || translations.fr;

      const logoBase64 = getLogoBase64();

      if (logoBase64) {
        try {
          const logoBuffer = Buffer.from(logoBase64.split(',')[1] || logoBase64, 'base64');

          const pageWidth = doc.page.width;
          const maxLogoWidth = 140;
          const logoWidth = Math.min(
            maxLogoWidth,
            pageWidth - doc.page.margins.left - doc.page.margins.right
          );
          const logoX = (pageWidth - logoWidth) / 2;
          const logoY = doc.page.margins.top;

          doc.image(logoBuffer, logoX, logoY, {
            width: logoWidth,
          });

          doc.y = logoY + logoWidth * (73 / 120) + 20;
        } catch {
          // No catch error
        }
      }

      doc
        .fontSize(22)
        .fillColor(primaryColor)
        .text(t.title, {
          align: 'center',
        })
        .moveDown(1);

      // Slogan + adresse (comme dans la capture)
      doc
        .fontSize(11)
        .fillColor(textColor)
        .text(t.headerLine, {
          align: 'center',
        })
        .moveDown(1);

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(t.addressLine, {
          align: 'center',
        })
        .moveDown(1);

      // Image du musée au centre (prend la place du QR côté tickets)
      const museumImgBase64 = getMuseumImageBase64();
      let afterImageY = doc.y;
      if (museumImgBase64) {
        try {
          const imgBuffer = Buffer.from(
            museumImgBase64.split(',')[1] || museumImgBase64,
            'base64'
          );

          const targetWidth = 500;
          const targetHeight = 330;

          const pageWidth = doc.page.width;
          const leftMargin = doc.page.margins.left;
          const rightMargin = doc.page.margins.right;
          const usableWidth = pageWidth - leftMargin - rightMargin;

          const width = Math.min(targetWidth, usableWidth);
          const height = (width * targetHeight) / targetWidth;

          const x = leftMargin + (usableWidth - width) / 2;
          const y = doc.y;

          doc.image(imgBuffer, x, y, {
            width,
            height,
          });

          afterImageY = y + height + 30;
        } catch {
          // ignore image errors
        }
      }
      doc.y = Math.max(doc.y, afterImageY);

      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const textX = doc.page.margins.left;

      doc
        .fontSize(14)
        .fillColor(secondaryColor)
        .text(`${t.giftCodeLabel}`, textX, doc.y, {
          width: contentWidth,
          align: 'center',
        })
        .moveDown(0.3);

      doc
        .fontSize(22)
        .fillColor(textColor)
        .font('Courier-Bold')
        .text(code, textX, doc.y, {
          width: contentWidth,
          align: 'center',
        })
        .moveDown(1.5);

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(secondaryColor)
        .text(t.reservationLabel, textX, doc.y, {
          align: 'center',
        })
        .moveDown(1)

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(primaryColor)
        .text(t.reservationUrlLabel, {
          link: 'https://museedujeuvideo.org/fr/ticket',
          underline: true,
          align: 'center',
        })
        .moveDown(2);

      doc
        .fontSize(12)
        .fillColor(secondaryColor)
        .text(t.museumName, {
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

