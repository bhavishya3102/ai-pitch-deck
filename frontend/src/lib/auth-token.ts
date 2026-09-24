type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;

/** Set once by <AuthBridge> so plain fetch calls can reach Clerk's session token. */
export function setTokenGetter(getter: TokenGetter | null) {
  getToken = getter;
}

/** Authorization header for API calls, or {} when signed out. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!getToken) return {};

  try {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // A failed token refresh shouldn't break the request — the API answers 401
    return {};
  }
}
