import { inferAdditionalFields, lastLoginMethodClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        avatarObjectKey: {
          input: false,
          required: false,
          returned: false,
          type: "string",
        },
      },
    }),
    lastLoginMethodClient(),
    usernameClient(),
  ],
});
