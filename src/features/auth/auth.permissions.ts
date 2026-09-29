import { roles } from './auth.const.ts';

/**
 * Permissions métier du musée. L'absence de permission vaut refus : les
 * anciens rôles techniques (`dev`, `museum`) ne donnent pas accès par défaut.
 */
export const museumPermissionRoles = {
  ticket_scan: [
    roles.administrateur,
    roles.bureau,
    roles.museum_administrateur,
    roles.museum_ticket_scan,
  ],
  ticket_manage: [roles.administrateur, roles.bureau, roles.museum_administrateur],
  configuration: [roles.administrateur, roles.bureau, roles.museum_administrateur, roles.museum_configuration],
  member_presence_manage: [roles.administrateur, roles.bureau, roles.museum_administrateur],
  donation_proof_manage: [roles.administrateur, roles.bureau, roles.museum_administrateur],
} as const;

export type MuseumPermission = keyof typeof museumPermissionRoles;
