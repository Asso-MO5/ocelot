import { roles } from './auth.const.ts';

/** Chaque route musée exige exactement un scope présent dans le claim Zitadel. */
export const museumScopes = {
  ticket_scan: roles.museum_mediateur,
  ticket_manage: roles.museum_ticket_manage,
  configuration: roles.museum_configuration,
  member_presence_manage: roles.museum_member_presence_manage,
  donation_proof_manage: roles.museum_donation_proof_manage,
} as const;

export type MuseumScope = keyof typeof museumScopes;
