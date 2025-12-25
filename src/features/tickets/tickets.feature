Feature: Gestion des tickets du musée
  En tant que visiteur, membre ou administrateur
  Je veux pouvoir créer, consulter et gérer des tickets
  Afin de réserver et gérer mes visites au musée

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer un ticket
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/tickets"
    Et que je fournis email, reservation_date, slot_start_time, slot_end_time, ticket_price
    Alors je reçois une réponse 201
    Et la réponse contient le ticket créé avec un id et un qr_code

  Scenario: Créer plusieurs tickets avec paiement
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/tickets/payment"
    Et que je fournis tickets, success_url, cancel_url
    Alors je reçois une réponse 201
    Et la réponse contient un checkout_session_id
    Et la réponse contient les tickets créés

  Scenario: Récupérer les tickets avec filtres
    Étant donné que des tickets existent
    Quand je fais une requête GET vers "/museum/tickets?status=paid&page=1&limit=10"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau tickets
    Et la réponse contient total, page, limit, totalPages

  Scenario: Récupérer un ticket par ID
    Étant donné que je suis authentifié
    Et qu'un ticket existe avec un ID spécifique
    Quand je fais une requête GET vers "/museum/tickets/:id"
    Alors je reçois une réponse 200
    Et la réponse contient le ticket avec l'ID demandé

  Scenario: Récupérer un ticket par code QR
    Étant donné qu'un ticket existe avec un code QR spécifique
    Quand je fais une requête GET vers "/museum/tickets/qr/:qrCode"
    Alors je reçois une réponse 200
    Et la réponse contient le ticket avec le code QR demandé

  Scenario: Valider un ticket (scan QR)
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un ticket existe avec status='paid' et used_at=null
    Quand je fais une requête POST vers "/museum/tickets/validate"
    Et que je fournis qr_code
    Alors je reçois une réponse 200
    Et la réponse indique que le ticket est valide
    Et le ticket est marqué comme utilisé (used_at est défini)

  Scenario: Erreur si le ticket est déjà utilisé
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un ticket existe avec used_at déjà défini
    Quand je fais une requête POST vers "/museum/tickets/validate"
    Et que je fournis qr_code
    Alors je reçois une réponse 400
    Et la réponse indique que le ticket est déjà utilisé

  Scenario: Mettre à jour un ticket
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un ticket existe
    Quand je fais une requête PUT vers "/museum/tickets/:id"
    Et que je fournis de nouvelles valeurs
    Alors je reçois une réponse 200
    Et la réponse contient le ticket mis à jour

  Scenario: Supprimer un ticket
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un ticket existe
    Quand je fais une requête DELETE vers "/museum/tickets/:id"
    Alors je reçois une réponse 204
    Et le ticket est supprimé de la base de données

  Scenario: Récupérer les statistiques des tickets
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et que des tickets existent
    Quand je fais une requête GET vers "/museum/tickets/stats"
    Alors je reçois une réponse 200
    Et la réponse contient total_tickets_sold, week_tickets_sold, total_donations
    Et la réponse contient average_ticket_price, hourly_stats, grouped_reservations

  Scenario: Récupérer les statistiques des créneaux de la semaine
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête GET vers "/museum/tickets/weekly-slots-stats"
    Alors je reçois une réponse 200
    Et la réponse contient week_start, week_end, slots_stats, daily_totals

  Scenario: Récupérer les tickets par checkout_id
    Étant donné qu'un checkout_id existe
    Et que des tickets sont associés à ce checkout_id
    Quand je fais une requête GET vers "/museum/tickets/checkout/:checkoutId"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de tickets associés au checkout_id

  Scenario: Visualiser un ticket en HTML
    Étant donné qu'un ticket existe avec status='paid' et used_at=null
    Et que la date de réservation est valide
    Quand je fais une requête GET vers "/museum/tickets/view/:qrCode"
    Alors je reçois une réponse 200
    Et la réponse est du type text/html
    Et la réponse contient le QR code et les détails du ticket

  Scenario: Erreur si le ticket n'existe pas
    Étant donné qu'aucun ticket n'existe avec cet ID
    Quand je fais une requête GET vers "/museum/tickets/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Ticket non trouvé"

  Scenario: Accès non autorisé pour créer un ticket sans les rôles requis
    Étant donné que je suis authentifié mais sans les rôles bureau ou dev
    Quand je fais une requête POST vers "/museum/tickets"
    Alors je reçois une réponse 403
    Et la réponse contient un message d'erreur "Accès refusé : rôle insuffisant"

  Scenario: Accès public pour créer des tickets avec paiement
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/tickets/payment"
    Alors je peux créer des tickets avec paiement
