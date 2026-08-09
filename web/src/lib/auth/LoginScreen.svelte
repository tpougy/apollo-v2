<script lang="ts">
  import { db } from "../db";

  let step = $state<"email" | "code">("email");
  let email = $state("");
  let code = $state("");
  let erro = $state<string | null>(null);
  let ocupado = $state(false);

  async function enviarCodigo() {
    if (ocupado) return;
    ocupado = true;
    erro = null;
    try {
      await db.auth.sendMagicCode({ email });
      step = "code";
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Falha ao enviar código.";
    } finally {
      ocupado = false;
    }
  }

  async function verificarCodigo() {
    if (ocupado) return;
    ocupado = true;
    erro = null;
    try {
      await db.auth.signInWithMagicCode({ email, code });
      // No manual navigation: db.useAuth() flips reactively and SignedIn takes over.
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Código inválido.";
    } finally {
      ocupado = false;
    }
  }

  function onSubmitEmail(event: SubmitEvent) {
    event.preventDefault();
    void enviarCodigo();
  }

  function onSubmitCode(event: SubmitEvent) {
    event.preventDefault();
    void verificarCodigo();
  }

  function reenviar() {
    void enviarCodigo();
  }
</script>

<div data-testid="login-screen">
  {#if step === "email"}
    <form onsubmit={onSubmitEmail}>
      <label for="login-email">E-mail</label>
      <input
        id="login-email"
        data-testid="login-email"
        type="email"
        bind:value={email}
        required
        disabled={ocupado}
      />
      <button type="submit" data-testid="login-submit" disabled={ocupado}>Enviar código</button>
    </form>
  {:else}
    <p>Código enviado para {email}</p>
    <form onsubmit={onSubmitCode}>
      <label for="login-code">Código</label>
      <input
        id="login-code"
        data-testid="login-code"
        type="text"
        inputmode="numeric"
        bind:value={code}
        required
        disabled={ocupado}
      />
      <button type="submit" data-testid="login-submit" disabled={ocupado}>Entrar</button>
      <button type="button" data-testid="login-resend" onclick={reenviar} disabled={ocupado}>
        Reenviar código
      </button>
    </form>
  {/if}

  {#if erro}
    <p data-testid="login-error">{erro}</p>
  {/if}
</div>
