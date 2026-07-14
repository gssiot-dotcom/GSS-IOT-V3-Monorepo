import type { AuthContext } from "@gss-iot/contracts";
import {
  Button,
  Center,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { t } from "../../app/i18n";
import { useAuth } from "../../shared/auth/auth-context";

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [context, setContext] = useState<AuthContext>("gss-admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setHasError(false);
    try {
      const session = await login(context, email, password);
      void navigate(session.context === "gss-admin" ? "/admin/dashboard" : "/company/dashboard");
    } catch {
      setHasError(true);
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper maw={400} p="xl" w="100%" withBorder>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={1}>{t("app.name")}</Title>
            <SegmentedControl
              data={[
                { label: t("auth.gss"), value: "gss-admin" },
                { label: t("auth.company"), value: "company-user" },
              ]}
              onChange={(value) => setContext(value as AuthContext)}
              value={context}
            />
            <TextInput
              autoComplete="email"
              label={t("auth.email")}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
            <PasswordInput
              autoComplete="current-password"
              label={t("auth.password")}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              value={password}
            />
            {hasError ? <div role="alert">{t("auth.loginError")}</div> : null}
            <Button loading={status === "loading"} type="submit">
              {t("auth.login")}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
