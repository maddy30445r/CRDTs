// Centralized auth-server access: one base URL, one place for the bearer-token
// header, one error type. Components call these instead of hand-rolling fetch.

import { API_URL } from "./env";

const AUTH_BASE = API_URL;

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type Board = { id: string; name: string };
export type BoardCreated = { id: string; name: string; owner_id: string };
export type Member = { user_id: string; name: string; added_at: string };

// One error type carrying the HTTP status, so callers can branch on it
// (e.g. 401 → re-login) instead of string-matching messages.
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchBoards(token: string): Promise<Board[]> {
  const res = await fetch(`${AUTH_BASE}/boards`, { headers: authHeaders(token) });
  if (res.status === 401) throw new ApiError(401, "unauthorized");
  if (!res.ok) throw new ApiError(res.status, "failed to load boards");
  return (await res.json()).boards;
}

export async function createBoard(
  token: string,
  name: string,
): Promise<BoardCreated> {
  const res = await fetch(`${AUTH_BASE}/boards`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error || "create failed";
    throw new ApiError(res.status, msg);
  }
  return (await res.json()).board;
}

export async function fetchMembers(
  token: string,
  boardId: string,
): Promise<{ members: Member[]; ownerId: string | null }> {
  const res = await fetch(`${AUTH_BASE}/boards/${boardId}/members`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new ApiError(res.status, "failed to load members");
  return res.json();
}

export async function addMember(
  token: string,
  boardId: string,
  username: string,
): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/boards/${boardId}/members`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error || "add failed";
    throw new ApiError(res.status, msg);
  }
}

export async function removeMember(
  token: string,
  boardId: string,
  userId: string,
): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/boards/${boardId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error || "remove failed";
    throw new ApiError(res.status, msg);
  }
}
