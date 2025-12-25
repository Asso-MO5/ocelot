const emailSubjects = {
  fr: {
    senderName: 'Le Musée du Jeu Vidéo',
    senderEmail: 'ne-pas-repondre@lemuseedujeuvideo.fr',
  },
  en: {
    senderName: 'The Video Game Museum',
    senderEmail: 'no-reply@lemuseedujeuvideo.fr',
  },
}

export const emailUtils = {
  async sendEmail({
    email,
    name,
    subject,
    body,
    language,
    attachments
  }: {
    email: string,
    name: string,
    subject: string,
    body: string,
    language: 'fr' | 'en',
    attachments?: Array<{
      name: string;
      content: string; // base64
      contentType: string;
    }>
  }) {

    try {
      const payload: any = {
        sender: {
          name: emailSubjects[language].senderName,
          email: emailSubjects[language].senderEmail
        },
        to: [
          {
            email,
            name
          }
        ],
        subject,
        htmlContent: body
      };

      if (attachments && attachments.length > 0) {
        payload.attachment = attachments.map(att => ({
          name: att.name,
          content: att.content,
          contentType: att.contentType
        }));
      }

      const res = await fetch(process.env.EMAIL_API_URL || '', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.EMAIL_API_KEY || '',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      return data;

    } catch (error) {

      throw error;
    }
  }

}