/* ── Header: solid + compact once scrolled ───────────────── */
const header = document.getElementById("siteHeader");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ── Scroll reveals ──────────────────────────────────────────
   Elements are visible by default; the `js` class on <html> is
   what hides them, so a failed script or an unsupported browser
   leaves the page fully readable rather than blank.           */
const revealables = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  revealables.forEach((el) => io.observe(el));
} else {
  revealables.forEach((el) => el.classList.add("in"));
}

/* ── Contact form → Web3Forms ────────────────────────────────
   Free form-to-email relay, no backend to run.
   TODO before going live:
     1. Go to https://web3forms.com, enter the address that should
        receive submissions.
     2. Paste the access key it gives you below.                */
const WEB3FORMS_ACCESS_KEY = "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY";

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");

const setStatus = (text, kind = "") => {
  status.textContent = text;
  status.className = kind ? `form-status ${kind}` : "form-status";
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    setStatus("Please fill in every field so we know how to help.", "err");
    form.reportValidity();
    return;
  }

  if (WEB3FORMS_ACCESS_KEY === "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY") {
    setStatus("This form isn't connected to an inbox yet — add a Web3Forms access key in script.js.", "err");
    return;
  }

  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  setStatus("Sending…");

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: "New HubiForm request",
        name: form.name.value,
        email: form.email.value,
        message: form.message.value,
      }),
    });
    const result = await response.json();

    if (!result.success) throw new Error(result.message || "Submission failed");

    setStatus("Thanks — we'll be in touch shortly.", "ok");
    form.reset();
  } catch (error) {
    setStatus("That didn't send. Please try again, or email us directly.", "err");
  } finally {
    submit.disabled = false;
  }
});
