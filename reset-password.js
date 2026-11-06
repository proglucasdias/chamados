const resetPasswordForm = document.querySelector("#resetPasswordForm");
const resetMessage = document.querySelector("#resetMessage");
const resetDescription = document.querySelector("#resetDescription");
const resetToken = new URLSearchParams(window.location.search).get("token") || "";

function setMessage(message, type = "hint-message") {
  resetMessage.textContent = message;
  resetMessage.className = type;
  resetMessage.hidden = false;
}

async function postResetRequest(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    data: await response.json().catch(() => ({})),
  };
}

async function validateToken() {
  if (!resetToken) {
    resetDescription.textContent = "Este link de redefinicao nao e valido.";
    setMessage("Solicite um novo link na tela de acesso.", "error-message");
    return;
  }

  try {
    const result = await postResetRequest("/api/password-reset/validate", {
      token: resetToken,
    });

    if (!result.ok || !result.data.valid) {
      resetDescription.textContent = "Este link expirou ou ja foi utilizado.";
      setMessage("Solicite um novo link na tela de acesso.", "error-message");
      return;
    }

    resetPasswordForm.hidden = false;
    resetMessage.hidden = true;
  } catch {
    setMessage("Nao foi possivel validar o link agora. Tente novamente.", "error-message");
  }
}

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetPasswordForm);
  const password = String(formData.get("newPassword") || "");
  const confirmation = String(formData.get("confirmPassword") || "");

  if (password.length < 8) {
    setMessage("A senha precisa ter pelo menos 8 caracteres.", "error-message");
    return;
  }

  if (password !== confirmation) {
    setMessage("A confirmacao da senha nao confere.", "error-message");
    return;
  }

  try {
    const result = await postResetRequest("/api/password-reset/confirm", {
      token: resetToken,
      password,
    });

    if (!result.ok || !result.data.ok) {
      setMessage(result.data.message || "Este link nao pode mais ser utilizado.", "error-message");
      return;
    }

    resetPasswordForm.reset();
    resetPasswordForm.hidden = true;
    resetDescription.textContent = "Sua senha foi atualizada.";
    setMessage("Voce ja pode entrar com a nova senha.", "success-message");
  } catch {
    setMessage("Nao foi possivel atualizar a senha. Tente novamente.", "error-message");
  }
});

validateToken();
