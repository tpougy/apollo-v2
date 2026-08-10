<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { toast } from "svelte-sonner";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
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
      toast.success("Código enviado.");
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Falha ao enviar código.";
      toast.error(erro);
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
      toast.success("Login realizado.");
    } catch (err) {
      erro = (err as { body?: { message?: string } }).body?.message ?? "Código inválido.";
      toast.error(erro);
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

<div data-testid="login-screen" class="flex min-h-screen items-center justify-center p-4">
  <Card class="w-full max-w-sm">
    <CardHeader>
      <CardTitle>Entrar</CardTitle>
      <CardDescription>
        {#if step === "email"}
          Informe seu e-mail para receber um código de acesso.
        {:else}
          Digite o código enviado para {email}.
        {/if}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if step === "email"}
        <form onsubmit={onSubmitEmail} class="space-y-4">
          <div class="space-y-2" data-testid="login-email-field">
            <Label for="login-email">E-mail</Label>
            <Input
              id="login-email"
              data-testid="login-email"
              type="email"
              bind:value={email}
              required
              disabled={ocupado}
            />
          </div>
          <Button type="submit" data-testid="login-submit" disabled={ocupado}>
            {#if ocupado}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            Enviar código
          </Button>
        </form>
      {:else}
        <p>Código enviado para {email}</p>
        <form onsubmit={onSubmitCode}>
          <Label for="login-code">Código</Label>
          <Input
            id="login-code"
            data-testid="login-code"
            type="text"
            inputmode="numeric"
            bind:value={code}
            required
            disabled={ocupado}
          />
          <Button type="submit" data-testid="login-submit" disabled={ocupado}>
            {#if ocupado}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            Entrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            data-testid="login-resend"
            onclick={reenviar}
            disabled={ocupado}
          >
            Reenviar código
          </Button>
        </form>
      {/if}

      {#if erro}
        <Alert variant="destructive">
          <CircleAlert class="size-4" />
          <AlertDescription data-testid="login-error">{erro}</AlertDescription>
        </Alert>
      {/if}
    </CardContent>
  </Card>
</div>
