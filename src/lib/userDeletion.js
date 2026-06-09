const getUserId = (account) => account?.id ?? account?.user_id ?? account?._id;

const hasTrueFlag = (account, keys) => keys.some((key) => account?.[key] === true);
const hasFalseFlag = (account, keys) => keys.some((key) => account?.[key] === false);

export const getUserDeleteProtection = (account, currentUser) => {
  const accountId = getUserId(account);
  const currentUserId = getUserId(currentUser);
  const isCurrentUser =
    (accountId != null && currentUserId != null && String(accountId) === String(currentUserId)) ||
    (account?.email && currentUser?.email &&
      String(account.email).toLowerCase() === String(currentUser.email).toLowerCase());

  if (isCurrentUser) return "You cannot delete your own account";

  if (
    hasTrueFlag(account, [
      "protected",
      "is_protected",
      "protected_demo_account",
      "protected_demo",
      "is_protected_demo",
      "is_demo_account",
      "is_demo",
      "demo",
      "demo_mode",
    ])
  ) {
    return "Protected account";
  }

  if (
    hasFalseFlag(account, [
      "can_delete",
      "canDelete",
      "can_be_deleted",
      "deletable",
      "is_deletable",
      "deletion_allowed",
    ])
  ) {
    return (
      account.delete_restriction_reason ||
      account.deletion_reason ||
      account.cannot_delete_reason ||
      "This user cannot be deleted"
    );
  }

  if (accountId == null) return "This user cannot be deleted";
  return null;
};

export { getUserId };
