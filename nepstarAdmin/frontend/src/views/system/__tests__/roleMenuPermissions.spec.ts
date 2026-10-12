import { describe, expect, it } from "vitest";
import { buildRoleMenuPermissions } from "../roleMenuPermissions";

const menus = [
  {
    id: 10,
    route_path: "/health",
    children: [
      { id: 41, route_path: "/health/ai-consult-settings" },
      { id: 42, route_path: "/health/ai-consult-overview" },
      { id: 99, route_path: "/health/plans" },
    ],
  },
];

describe("role menu permissions", () => {
  it("grants AI pages view only by default and preserves other menu actions on edit", () => {
    expect(
      buildRoleMenuPermissions([41, 42, 99], menus, { 99: "view" }, []),
    ).toEqual([
      { menu_id: 41, actions: "view" },
      { menu_id: 42, actions: "view" },
      { menu_id: 99, actions: "view" },
    ]);
  });

  it("can grant publishing without also granting settings edits", () => {
    expect(buildRoleMenuPermissions([41], menus, {}, ["publish"])).toEqual([
      { menu_id: 41, actions: "view,publish" },
    ]);
    expect(
      buildRoleMenuPermissions([41], menus, {}, ["edit", "publish"]),
    ).toEqual([{ menu_id: 41, actions: "view,edit,publish" }]);
  });

  it("grants sensitive conversation access only when explicitly selected", () => {
    expect(
      buildRoleMenuPermissions(
        [42],
        menus,
        { 42: "view,conversation" },
        [],
        [],
      ),
    ).toEqual([{ menu_id: 42, actions: "view" }]);
    expect(
      buildRoleMenuPermissions([42], menus, {}, [], ["conversation", "delete"]),
    ).toEqual([{ menu_id: 42, actions: "view,conversation" }]);
    expect(
      buildRoleMenuPermissions([99], menus, {}, [], ["conversation"])[0]
        .actions,
    ).not.toContain("conversation");
  });

  it("does not grant AI actions if the related menu is unchecked", () => {
    expect(
      buildRoleMenuPermissions([99], menus, {}, ["edit", "publish"]),
    ).toEqual([{ menu_id: 99, actions: "view,add,edit,delete,export,import" }]);
  });
});
