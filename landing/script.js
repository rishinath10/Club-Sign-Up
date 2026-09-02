// Contact form -> Web3Forms (free form-to-email service, no backend needed).
// TODO: replace this placeholder with your own access key before going live:
//   1. Go to https://web3forms.com and enter the email you want submissions sent to.
//   2. Copy the access key it gives you.
//   3. Paste it below in place of "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY".
const WEB3FORMS_ACCESS_KEY = "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY";

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (WEB3FORMS_ACCESS_KEY === "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY") {
    status.textContent = "Form isn't wired up to an email yet — add a Web3Forms access key in script.js.";
    status.className = "form-status err";
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  status.textContent = "Sending...";
  status.className = "form-status";

  const payload = {
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: "New HubiForm request",
    name: form.name.value,
    email: form.email.value,
    message: form.message.value,
  };

  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.success) {
      status.textContent = "Thanks! We'll get back to you shortly.";
      status.className = "form-status ok";
      form.reset();
    } else {
      throw new Error(result.message || "Submission failed");
    }
  } catch (err) {
    status.textContent = "Something went wrong sending that — please try again.";
    status.className = "form-status err";
  } finally {
    submitBtn.disabled = false;
  }
});
