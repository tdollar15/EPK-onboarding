// Assign the first admin at the moment an invite-only Identity account is confirmed.
// Never assign roles based on user-editable metadata or a client-supplied request body.
export default {
  userSignup(event) {
    const authorizedEmail = (Netlify.env.get('EPK_ADMIN_EMAIL') || '').trim().toLowerCase();
    const incoming = (event?.user?.email || '').trim().toLowerCase();
    if (!authorizedEmail || incoming !== authorizedEmail) return;
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...(event.user.appMetadata || {}),
          roles: [...new Set([...(event.user.appMetadata?.roles || []), 'admin'])],
        },
      },
    };
  },
};