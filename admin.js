const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const recoveryForm = document.querySelector("#recoveryForm");
const recoveryMessage = document.querySelector("#recoveryMessage");

applyButtonSettings(document);

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const authResult = authenticateAdmin(username, password);

  if (!authResult.ok) {
    loginError.textContent =
      authResult.message || "Usuario ou senha invalidos.";
    loginError.hidden = false;
    return;
  }

  loginError.hidden = true;
  loginForm.reset();
  window.location.href = "dashboard.html";
});

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(recoveryForm);
  const identifier = String(formData.get("identifier") || "").trim();

  if (!identifier) {
    recoveryMessage.textContent = "Informe o usuario ou e-mail cadastrado.";
    recoveryMessage.className = "error-message";
    recoveryMessage.hidden = false;
    return;
  }

  try {
    const response = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier }),
    });

    if (!response.ok) {
      throw new Error("request_failed");
    }

    recoveryForm.reset();
    recoveryMessage.textContent =
      "Se os dados estiverem cadastrados, um link de redefinicao foi enviado para o e-mail.";
    recoveryMessage.className = "success-message";
    recoveryMessage.hidden = false;
  } catch {
    recoveryMessage.textContent = "Nao foi possivel solicitar o link agora. Tente novamente.";
    recoveryMessage.className = "error-message";
    recoveryMessage.hidden = false;
  }
});
