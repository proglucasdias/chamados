# Como colocar o sistema de chamados online

Este sistema roda com Node.js e salva os dados em arquivos JSON dentro da pasta `data`.
Por isso, ele precisa ficar hospedado em um servidor que permaneça ligado 24 horas por dia.

## Melhor caminho recomendado

Contratar uma VPS/servidor cloud e publicar o projeto nele.

Exemplos de onde hospedar:
- Hostinger VPS
- Locaweb VPS
- DigitalOcean
- AWS Lightsail
- Azure VM
- Servidor Windows/Linux da empresa

## Por que nao usar apenas o Chrome ou 127.0.0.1?

O endereco `127.0.0.1` ou `localhost` abre somente no proprio computador onde o sistema esta rodando.
Usuarios de fora da rede nao conseguem acessar esse endereco.

## Passos gerais em uma VPS

1. Instalar Node.js no servidor.
2. Copiar a pasta do sistema para o servidor.
3. Entrar na pasta do projeto.
4. Rodar:

```powershell
npm start
```

5. Liberar a porta usada pelo sistema no firewall.
6. Apontar um dominio ou subdominio para o IP do servidor.
7. Configurar HTTPS com certificado SSL.

## Comando local do sistema

```powershell
node dev-server.js
```

Por padrao, ele roda na porta `8080`.
Em hospedagens online, tambem aceita a porta definida pela variavel `PORT`.

## Atencao antes de publicar

Antes de liberar para a internet, recomenda-se reforcar a seguranca da area administrativa:

- proteger as rotas administrativas no servidor;
- nao deixar senhas expostas no navegador;
- usar senhas criptografadas;
- fazer backup automatico da pasta `data`;
- usar HTTPS.

Para uso interno simples, uma VPN corporativa ou acesso remoto ao servidor pode ser suficiente.
Para acesso publico pela internet, o ideal e ajustar a seguranca antes de divulgar o link.
