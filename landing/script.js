/* ── Reveals ─────────────────────────────────────────────────
   Everything is visible by default. The `js` class on <html> is
   what hides it, so a failed script or a browser without
   IntersectionObserver leaves the page fully readable.        */

const revealable = document.querySelectorAll(".rise, .entry, .rule-draw");

// Stagger the entries down their list rather than hard-coding delays.
document.querySelectorAll(".entries").forEach((list) => {
  list.querySelectorAll(".entry").forEach((entry, i) => {
    entry.style.setProperty("--d", `${i * 110}ms`);
  });
});

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );
  revealable.forEach((el) => io.observe(el));
} else {
  revealable.forEach((el) => el.classList.add("in"));
}

/* ── Enquiry form → Web3Forms ────────────────────────────────
   Free form-to-email relay, nothing to run server-side.
   Before going live:
     1. Visit https://web3forms.com and enter the address that
        should receive enquiries.
     2. Paste the access key it returns below.                  */

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
    setStatus("This form is not connected to an inbox yet — add a Web3Forms access key in script.js.", "err");
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
        subject: "New HubiForm enquiry",
        name: form.name.value,
        email: form.email.value,
        message: form.message.value,
      }),
    });
    const result = await response.json();

    if (!result.success) throw new Error(result.message || "Submission failed");

    setStatus("Thank you — we will be in touch shortly.");
    form.reset();
  } catch (error) {
    setStatus("That did not send. Please try again, or email us directly.", "err");
  } finally {
    submit.disabled = false;
  }
});
