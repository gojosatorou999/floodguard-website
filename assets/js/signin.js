/* ── header sign in / sign out ─────────────────────────────────
   Every element marked [data-signin] (header button, menu entry) is a
   "Sign in" that goes to /auth.html and brings the visitor back here,
   until a Supabase session exists — then it becomes "Sign out". A link
   (<a href="/auth.html">) works even if this module never loads. */
import { getSession, signOut } from "/assets/js/supabase.js";

const btns = [...document.querySelectorAll("[data-signin]")];
const back = "/auth.html?next=" + encodeURIComponent(location.pathname + location.search);

for (const b of btns) {
  if (b.tagName === "A") b.href = back;
}

getSession().then(sess => {
  if (!sess) return;
  const who = sess.user.user_metadata?.name || sess.user.user_metadata?.full_name || sess.user.email;
  for (const b of btns) {
    (b.querySelector("b") || b).textContent = "Sign out";
    b.title = "Signed in as " + who;
    b.onclick = async e => {
      e.preventDefault();
      await signOut();
      location.reload();
    };
  }
}).catch(() => { });
