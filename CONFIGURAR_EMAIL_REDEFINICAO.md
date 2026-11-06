# Configuracao de e-mail para redefinicao de senha

O envio do link de redefinicao e feito pelo servidor. As senhas do e-mail nao ficam gravadas no codigo.

## Variaveis necessarias no Windows Server

Abra o PowerShell como administrador e ajuste os valores abaixo para o provedor de e-mail da empresa:

```powershell
[Environment]::SetEnvironmentVariable("SMTP_HOST", "smtp.suaempresa.com", "Machine")
[Environment]::SetEnvironmentVariable("SMTP_PORT", "587", "Machine")
[Environment]::SetEnvironmentVariable("SMTP_SECURE", "false", "Machine")
[Environment]::SetEnvironmentVariable("SMTP_USER", "sistema@suaempresa.com", "Machine")
[Environment]::SetEnvironmentVariable("SMTP_PASS", "SENHA-DO-E-MAIL", "Machine")
[Environment]::SetEnvironmentVariable("SMTP_FROM", "Central de Chamados <sistema@suaempresa.com>", "Machine")
[Environment]::SetEnvironmentVariable("APP_BASE_URL", "https://chamados.suaempresa.com", "Machine")
```

Para Microsoft 365, normalmente use a porta `587` e `SMTP_SECURE=false`. A conta de e-mail precisa ter envio SMTP autorizado.

Depois de configurar, reinicie o servico do sistema ou o processo `node dev-server.js`.

## Como funciona

1. A pessoa informa o usuario ou e-mail na tela de administrador.
2. O sistema responde sem revelar se aquele cadastro existe.
3. Caso exista um e-mail cadastrado, o servidor envia um link de uso unico.
4. O link expira em uma hora e abre a pagina segura para criar a nova senha.

Usuarios sem e-mail cadastrado nao receberao o link. Cadastre o e-mail do usuario no painel de administracao antes de usar a recuperacao.
