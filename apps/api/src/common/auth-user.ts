export interface AuthUser {
  userId: string;
  email: string;
  role: "user" | "admin";
  sessionId: string;
  tokenType: "access";
}
