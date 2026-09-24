import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { setTokenGetter } from "../lib/auth-token.ts";

/**
 * Connects Clerk to the plain-fetch API layer:
 *  - hands the session token to api.ts
 *  - throws away cached decks when the signed-in user changes, so one user
 *    never sees another user's data from the cache
 */
export function AuthBridge() {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    queryClient.clear();
  }, [userId, queryClient]);

  return null;
}
