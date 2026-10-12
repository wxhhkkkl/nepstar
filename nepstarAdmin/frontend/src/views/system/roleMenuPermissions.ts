export interface RoleMenuNode {
  id: number;
  route_path?: string;
  children?: RoleMenuNode[];
}

export function findRoleMenuId(
  menus: RoleMenuNode[],
  routePath: string,
): number | null {
  for (const menu of menus) {
    if (menu.route_path === routePath) return menu.id;
    const childId = findRoleMenuId(menu.children || [], routePath);
    if (childId !== null) return childId;
  }
  return null;
}

export function buildRoleMenuPermissions(
  selectedIds: number[],
  menus: RoleMenuNode[],
  existingActions: Record<number, string>,
  aiSettingsExtraActions: string[],
  aiOverviewExtraActions: string[] = [],
) {
  const settingsId = findRoleMenuId(menus, "/health/ai-consult-settings");
  const overviewId = findRoleMenuId(menus, "/health/ai-consult-overview");
  return selectedIds.map((menu_id) => {
    if (menu_id === settingsId) {
      const extras = aiSettingsExtraActions.filter(
        (action) => action === "edit" || action === "publish",
      );
      return { menu_id, actions: ["view", ...extras].join(",") };
    }
    if (menu_id === overviewId)
      return {
        menu_id,
        actions: aiOverviewExtraActions.includes("conversation")
          ? "view,conversation"
          : "view",
      };
    return {
      menu_id,
      actions: existingActions[menu_id] || "view,add,edit,delete,export,import",
    };
  });
}
