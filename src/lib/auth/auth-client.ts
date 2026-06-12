import { createAuthClient } from "better-auth/react";
import { lastLoginMethodClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [lastLoginMethodClient(), usernameClient()],
});
