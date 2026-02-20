export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

export async function verifySession(): Promise<SessionUser | null> {
  return null;
}
