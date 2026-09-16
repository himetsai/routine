import { actions } from "astro:actions";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SNAPSHOT_KEY } from "../data/outbox";
import { refreshOwner } from "../data/owner";
import { toast } from "../data/toast";

export function SignIn({ owner }: { owner: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const passphrase = String(new FormData(e.currentTarget).get("password") ?? "");
    setBusy(true);
    const { error } = await actions.login({ passphrase });
    setBusy(false);
    if (error) return toast(error.message, "error");
    refreshOwner();
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: SNAPSHOT_KEY });
  }

  async function signOut() {
    await actions.logout({});
    refreshOwner();
    toast("Signed out");
  }

  if (owner) {
    return (
      <button type="button" onClick={signOut} className="link">
        Sign out
      </button>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="link">
        Sign in
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      {/* A username field lets iOS Keychain file the passphrase as a proper credential. */}
      <input type="text" name="username" autoComplete="username" defaultValue="ray" className="hidden" readOnly />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Passphrase"
        autoFocus
        required
        className="field mt-0 w-40 py-1 text-sm"
      />
      <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5">
        {busy ? "…" : "Go"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="link">
        Cancel
      </button>
    </form>
  );
}
