import { getUserDeleteProtection } from "./userDeletion";

describe("getUserDeleteProtection", () => {
  const currentUser = { id: "admin-1", email: "admin@example.com" };

  test("prevents deleting the currently logged-in user", () => {
    expect(getUserDeleteProtection({ id: "admin-1" }, currentUser)).toBe(
      "You cannot delete your own account"
    );
  });

  test("prevents deleting a backend-protected demo account", () => {
    expect(getUserDeleteProtection({ id: "demo-1", is_demo: true }, currentUser)).toBe(
      "Protected account"
    );
  });

  test("uses a backend deletion restriction reason", () => {
    expect(
      getUserDeleteProtection(
        { id: "admin-2", can_delete: false, delete_restriction_reason: "Cannot delete last admin user" },
        currentUser
      )
    ).toBe("Cannot delete last admin user");
  });

  test("allows deleting another removable user", () => {
    expect(getUserDeleteProtection({ id: "cashier-1", can_delete: true }, currentUser)).toBeNull();
  });
});
