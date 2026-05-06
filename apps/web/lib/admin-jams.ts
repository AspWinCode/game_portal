// Re-exports from api.ts for backwards compatibility within the admin dashboard.
export {
  getAdminGames as getAdminJams,
  getAdminGameTemplates as getAdminJamTemplates,
  createAdminGame as createAdminJam,
  createAdminGameFromTemplate as createAdminJamFromTemplate,
  duplicateAdminGame as duplicateAdminJam,
  archiveAdminGame as archiveAdminJam,
  deleteAdminGame as deleteAdminJam
} from "./api";
