export function notifyRoleChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("briefpay-role"));
  }
}
